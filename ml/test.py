import joblib
import os

model_path = "ml/models/model.pkl"
if os.path.exists(model_path):
    data = joblib.load(model_path)
    print(f"Type: {type(data)}")
    print(f"Keys: {data.keys() if isinstance(data, dict) else 'N/A'}")
    
    # If it's a dictionary, see what it contains
    if isinstance(data, dict):
        for key, value in data.items():
            print(f"  {key}: {type(value)}")