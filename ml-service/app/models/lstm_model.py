"""
Temporal LSTM Model for Multi-Horizon Monsoon Probability Prediction
(ml-service/app/models/lstm_model.py)

Requirement 16:
- Input: historical sequence of observations (configurable 30 days)
- Features: rainfall, temperature, humidity, pressure, wind, ENSO, IOD,
  MJO phase encoding (sin/cos), MJO amplitude.
- Do NOT train an LSTM if there is insufficient historical data; instead return
  "Insufficient historical sequence length for LSTM training." and allow XGBoost
  to operate independently.
"""

from typing import Dict, Any, List, Tuple
import joblib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

from app.config import (
    ARTIFACTS_DIR,
    CLASSIFICATION_TARGETS,
    FORECAST_HORIZONS,
    LSTM_CONFIG,
)
from app.data.feature_engineering import SEQUENCE_FEATURE_COLUMNS

LSTM_ARTIFACT_PATH = ARTIFACTS_DIR / "lstm_model.pt"
LSTM_SCALER_PATH = ARTIFACTS_DIR / "lstm_scaler.joblib"


class MonsoonMultiTaskLSTMNet(nn.Module):
    """
    PyTorch LSTM network taking (batch, seq_len, n_features) and outputting
    16 logits corresponding to 4 targets x 4 horizons (7D, 14D, 21D, 30D).
    """

    def __init__(self, input_dim: int, hidden_dim: int = 32, num_layers: int = 1, out_dim: int = 16):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
        )
        self.head = nn.Sequential(
            nn.Linear(hidden_dim, 24),
            nn.ReLU(),
            nn.Dropout(0.15),
            nn.Linear(24, out_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.lstm(x)
        last_hidden = out[:, -1, :]
        logits = self.head(last_hidden)
        return logits


class MonsoonLSTMModel:
    def __init__(self) -> None:
        self.seq_len = int(LSTM_CONFIG["SEQUENCE_LENGTH_DAYS"])
        self.hidden_size = int(LSTM_CONFIG["HIDDEN_SIZE"])
        self.num_layers = int(LSTM_CONFIG["NUM_LAYERS"])
        self.target_keys: List[str] = [
            f"{t}_{h}d" for h in FORECAST_HORIZONS for t in CLASSIFICATION_TARGETS
        ]
        self.mean_: np.ndarray = np.zeros(len(SEQUENCE_FEATURE_COLUMNS))
        self.std_: np.ndarray = np.ones(len(SEQUENCE_FEATURE_COLUMNS))
        self.net: MonsoonMultiTaskLSTMNet | None = None
        self.is_trained: bool = False
        self.status_message: str = "Not trained"

    def _build_sequences_from_continuous(
        self,
        continuous_df: pd.DataFrame,
        target_rows_df: pd.DataFrame,
    ) -> Tuple[np.ndarray, np.ndarray, List[int]]:
        """
        Builds 30-day strictly backward-looking sequences [T-seq_len+1 ... T]
        from the continuous daily block time series for every sample in `target_rows_df`.
        """
        # Index continuous records per block by date
        block_lookup: Dict[str, pd.DataFrame] = {}
        for loc_id, grp in continuous_df.groupby("location_id", sort=False):
            s_grp = grp.sort_values("date").reset_index(drop=True)
            block_lookup[str(loc_id)] = s_grp

        sequences = []
        labels = []
        valid_indices = []

        target_cols = [f"target_{k}" for k in self.target_keys]

        for row_idx, row in target_rows_df.iterrows():
            loc_id = str(row["location_id"])
            init_date = row["date"]
            bdf = block_lookup.get(loc_id)
            if bdf is None:
                continue
            # Strictly causal slice: date <= init_date
            hist_slice = bdf[bdf["date"] <= init_date]
            if len(hist_slice) < self.seq_len:
                continue
            seq_window = hist_slice.iloc[-self.seq_len :][SEQUENCE_FEATURE_COLUMNS].values.astype(np.float32)
            seq_norm = (seq_window - self.mean_) / self.std_
            sequences.append(seq_norm)
            if all(c in row for c in target_cols):
                labels.append([float(row[c]) for c in target_cols])
            valid_indices.append(int(row_idx))

        X_seq = np.array(sequences, dtype=np.float32) if sequences else np.empty((0, self.seq_len, len(SEQUENCE_FEATURE_COLUMNS)), dtype=np.float32)
        y_seq = np.array(labels, dtype=np.float32) if labels else np.empty((0, len(self.target_keys)), dtype=np.float32)
        return X_seq, y_seq, valid_indices

    def fit(
        self,
        continuous_df: pd.DataFrame,
        train_df: pd.DataFrame,
        val_df: pd.DataFrame,
    ) -> Dict[str, Any]:
        # Check sufficiency (Requirement 16)
        if len(train_df) < int(LSTM_CONFIG["MIN_REQUIRED_SAMPLES"]):
            self.is_trained = False
            self.status_message = "Insufficient historical sequence length for LSTM training."
            return {
                "trained": False,
                "message": self.status_message,
            }

        # Compute feature normalization parameters strictly on training set
        feat_vals = train_df[SEQUENCE_FEATURE_COLUMNS].values.astype(np.float32)
        self.mean_ = np.mean(feat_vals, axis=0)
        self.std_ = np.maximum(np.std(feat_vals, axis=0), 1e-4)

        X_train, y_train, _ = self._build_sequences_from_continuous(continuous_df, train_df)
        X_val, y_val, _ = self._build_sequences_from_continuous(continuous_df, val_df)

        if len(X_train) < int(LSTM_CONFIG["MIN_REQUIRED_SAMPLES"]):
            self.is_trained = False
            self.status_message = "Insufficient historical sequence length for LSTM training."
            return {
                "trained": False,
                "message": self.status_message,
            }

        torch.manual_seed(42)
        self.net = MonsoonMultiTaskLSTMNet(
            input_dim=len(SEQUENCE_FEATURE_COLUMNS),
            hidden_dim=self.hidden_size,
            num_layers=self.num_layers,
            out_dim=len(self.target_keys),
        )

        # Compute class weights per output head so rarer events (e.g., heavy rain, false onset) are learned
        pos_counts = np.maximum(np.sum(y_train == 1.0, axis=0), 1.0)
        neg_counts = np.maximum(np.sum(y_train == 0.0, axis=0), 1.0)
        pos_weights = torch.tensor(np.clip(neg_counts / pos_counts, 0.8, 10.0), dtype=torch.float32)

        criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weights)
        optimizer = torch.optim.Adam(self.net.parameters(), lr=float(LSTM_CONFIG["LEARNING_RATE"]))

        dataset = TensorDataset(torch.tensor(X_train), torch.tensor(y_train))
        loader = DataLoader(dataset, batch_size=int(LSTM_CONFIG["BATCH_SIZE"]), shuffle=False)

        self.net.train()
        epochs = int(LSTM_CONFIG["EPOCHS"])
        final_loss = 0.0
        for _ in range(epochs):
            epoch_loss = 0.0
            for bx, by in loader:
                optimizer.zero_grad()
                logits = self.net(bx)
                loss = criterion(logits, by)
                loss.backward()
                optimizer.step()
                epoch_loss += float(loss.item()) * len(bx)
            final_loss = epoch_loss / max(len(X_train), 1)

        self.net.eval()
        self.is_trained = True
        self.status_message = (
            f"LSTM trained on {len(X_train)} 30-day causal sequences "
            f"(val sequences: {len(X_val)}, final BCE loss: {final_loss:.4f})."
        )
        return {
            "trained": True,
            "sequence_length_days": self.seq_len,
            "train_sequences": int(len(X_train)),
            "val_sequences": int(len(X_val)),
            "final_train_loss": round(final_loss, 4),
            "message": self.status_message,
        }

    def predict_proba_dict(
        self,
        continuous_df: pd.DataFrame,
        eval_df: pd.DataFrame,
    ) -> Dict[str, np.ndarray]:
        """
        Returns dictionary mapping `{target}_{horizon}d` -> 1D probability array aligned to `eval_df`.
        """
        n = len(eval_df)
        default_out = {k: np.full(n, 0.5, dtype=float) for k in self.target_keys}
        if not self.is_trained or self.net is None:
            return default_out

        eval_reset = eval_df.reset_index(drop=True)
        X_seq, _, valid_idx = self._build_sequences_from_continuous(continuous_df, eval_reset)
        if len(X_seq) == 0:
            return default_out

        self.net.eval()
        with torch.no_grad():
            logits = self.net(torch.tensor(X_seq, dtype=torch.float32))
            probs = torch.sigmoid(logits).numpy()

        out: Dict[str, np.ndarray] = {}
        for col_i, key in enumerate(self.target_keys):
            arr = np.full(n, 0.5, dtype=float)
            for seq_pos, df_row_i in enumerate(valid_idx):
                arr[df_row_i] = float(np.clip(probs[seq_pos, col_i], 1e-4, 1.0 - 1e-4))
            out[key] = arr
        return out

    def save(self) -> None:
        if self.net is not None and self.is_trained:
            torch.save(self.net.state_dict(), LSTM_ARTIFACT_PATH)
        joblib.dump(
            {
                "is_trained": self.is_trained,
                "status_message": self.status_message,
                "seq_len": self.seq_len,
                "hidden_size": self.hidden_size,
                "num_layers": self.num_layers,
                "target_keys": self.target_keys,
                "mean": self.mean_,
                "std": self.std_,
            },
            LSTM_SCALER_PATH,
        )

    @classmethod
    def load(cls) -> "MonsoonLSTMModel":
        inst = cls()
        if not LSTM_SCALER_PATH.exists():
            return inst
        meta = joblib.load(LSTM_SCALER_PATH)
        inst.is_trained = bool(meta.get("is_trained", False))
        inst.status_message = str(meta.get("status_message", "Loaded"))
        inst.seq_len = int(meta.get("seq_len", 30))
        inst.hidden_size = int(meta.get("hidden_size", 32))
        inst.num_layers = int(meta.get("num_layers", 1))
        inst.target_keys = list(meta.get("target_keys", inst.target_keys))
        inst.mean_ = meta["mean"]
        inst.std_ = meta["std"]
        if inst.is_trained and LSTM_ARTIFACT_PATH.exists():
            inst.net = MonsoonMultiTaskLSTMNet(
                input_dim=len(SEQUENCE_FEATURE_COLUMNS),
                hidden_dim=inst.hidden_size,
                num_layers=inst.num_layers,
                out_dim=len(inst.target_keys),
            )
            inst.net.load_state_dict(torch.load(LSTM_ARTIFACT_PATH, map_location="cpu", weights_only=True))
            inst.net.eval()
        return inst
