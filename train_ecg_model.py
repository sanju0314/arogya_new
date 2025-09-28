import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import pandas as pd
import numpy as np

# ---------------------------
# Dataset
# ---------------------------
class ECGDataset(Dataset):
    def _init_(self, csv_file):
        df = pd.read_csv(csv_file)
        self.X = df.iloc[:, :-1].values.astype(np.float32)  # features
        self.y = df.iloc[:, -1].values.astype(np.int64)      # labels
    
    def _len_(self):
        return len(self.y)
    
    def _getitem_(self, idx):
        return self.X[idx], self.y[idx]

# ---------------------------
# Model
# ---------------------------
class ECGModel(nn.Module):
    def _init_(self, input_dim=500):  # change if CSV has different feature count
        super(ECGModel, self)._init_()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 2)
        )
    def forward(self, x):
        return self.net(x)

# ---------------------------
# Load Dataset
# ---------------------------
dataset = ECGDataset("synthetic_ecg_dataset.csv")  # replace with your CSV path
train_size = int(0.8 * len(dataset))
val_size = len(dataset) - train_size
train_dataset, val_dataset = torch.utils.data.random_split(dataset, [train_size, val_size])

train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
val_loader = DataLoader(val_dataset, batch_size=32)

# ---------------------------
# Train Model
# ---------------------------
model = ECGModel(input_dim=dataset.X.shape[1])
criterion = nn.CrossEntropyLoss()
optimizer = optim.Adam(model.parameters(), lr=0.001)

for epoch in range(20):
    model.train()
    total_loss = 0
    for X_batch, y_batch in train_loader:
        optimizer.zero_grad()
        outputs = model(X_batch)
        loss = criterion(outputs, y_batch)
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
    print(f"Epoch {epoch+1}/20, Loss: {total_loss/len(train_loader):.4f}")

# ---------------------------
# Save Trained Model
# ---------------------------
torch.save(model.state_dict(), "ecg_model.pt")
print("Trained model saved as ecg_model.pt")
