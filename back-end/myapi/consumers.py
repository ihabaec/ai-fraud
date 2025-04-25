import json
import asyncio
import random
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from logging import getLogger

# Setup logging
logger = getLogger(__name__)

class FraudDetectionConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        # Send connection confirmation
        await self.send(text_data=json.dumps({"message": "Connected to WebSocket"}))
        
        # Log connection
        logger.info("WebSocket connection established")
        
        # Start sending predictions
        self.prediction_task = asyncio.create_task(self.send_periodic_predictions())

    async def disconnect(self, close_code):
        logger.info(f"WebSocket disconnected with code: {close_code}")
        # Cancel the task if it's running
        if hasattr(self, 'prediction_task'):
            self.prediction_task.cancel()

    async def receive(self, text_data):
        logger.info(f"Received message: {text_data}")
        try:
            data = json.loads(text_data)
            transaction = data.get('transaction')
            if transaction:
                result = await self.get_predictions(transaction)
                await self.send(text_data=json.dumps(result))
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
            await self.send(text_data=json.dumps({"error": str(e)}))

    async def send_periodic_predictions(self):
        try:
            counter = 0
            while True:
                await asyncio.sleep(2)  # Send a prediction every 2 seconds
                
                # Generate a random transaction
                transaction = self.generate_random_transaction()
                
                # Generate prediction
                result = await self.get_predictions(transaction)
                
                # Log every few transactions
                if counter % 5 == 0:
                    logger.info(f"Sending prediction {counter}")
                
                await self.send(text_data=json.dumps(result))
                counter += 1
        except asyncio.CancelledError:
            logger.info("Periodic predictions task cancelled")
        except Exception as e:
            logger.error(f"Error in send_periodic_predictions: {str(e)}")

    def generate_random_transaction(self):
        """Generate a random transaction to simulate data"""
        transaction = {
            'transaction_id': f"tx-{random.randint(10000, 99999)}",
            'Time': random.randint(0, 172800),  # Random time in seconds (2 days)
            'Amount': round(random.uniform(1.0, 5000.0), 2)  # Random amount between $1 and $5000
        }
        
        # Add 28 V features with random values
        for i in range(1, 29):
            transaction[f'V{i}'] = round(random.uniform(-10, 10), 6)
            
        # Occasionally make a fraudulent transaction
        is_fraud = random.random() < 0.1  # 10% chance of fraud
        if is_fraud:
            # Make some features more likely to indicate fraud
            transaction['V1'] = round(random.uniform(-20, -5), 6)
            transaction['V3'] = round(random.uniform(-15, -2), 6)
            transaction['Amount'] = round(random.uniform(500, 5000), 2)
            
        return transaction

    async def get_predictions(self, transaction):
        """Generate predictions for a transaction"""
        # In a real system, this would call your ML models
        # Here, we're simulating the predictions
        
        # Calculate a "fraud score" based on some of the features
        fraud_score = 0
        if 'V1' in transaction and transaction['V1'] < -5:
            fraud_score += 0.3
        if 'V3' in transaction and transaction['V3'] < -5:
            fraud_score += 0.2
        if 'Amount' in transaction and transaction['Amount'] > 1000:
            fraud_score += 0.2
            
        # Random element to make it interesting
        fraud_score += random.uniform(0, 0.3)
        
        # Convert to binary predictions
        logistic_pred = 1 if fraud_score > 0.5 else 0
        rf_pred = 1 if fraud_score > 0.6 else 0
        xgb_pred = 1 if fraud_score > 0.7 else 0
        
        predictions = {
            "logistic": logistic_pred,
            "random_forest": rf_pred,
            "xgboost": xgb_pred,
            "fraud_score": min(round(fraud_score, 2), 0.99)  # Cap at 0.99
        }
        
        return {
            "predictions": predictions,
            "transaction": transaction
        }