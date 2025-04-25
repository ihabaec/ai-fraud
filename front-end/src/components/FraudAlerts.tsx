import React from 'react';
import { Transaction, Prediction } from '../types/types';

interface FraudAlertsProps {
  transactions: Transaction[];
  predictions: Prediction[]; // Add predictions
}

const FraudAlerts: React.FC<FraudAlertsProps> = ({ transactions, predictions }) => {
  // Find fraudulent transactions using multiple detection methods
  const fraudulentTransactions = transactions.filter((transaction, index) => {
    // Method 1: Check if Class field is 1 (if available)
    if (transaction.Class === 1) {
      return true;
    }
    
    // Method 2: Check prediction results (if available)
    if (index < predictions.length) {
      const prediction = predictions[index];
      if (prediction.logistic === 1 || prediction.random_forest === 1 || prediction.xgboost === 1) {
        return true;
      }
    }
    
    // Method 3: Check suspicious transaction features
    const hasNegativeV1 = transaction.V1 !== undefined && transaction.V1 < -3;
    const hasLargeAmount = transaction.Amount !== undefined && transaction.Amount > 1000;
    
    return hasNegativeV1 || hasLargeAmount;
  });
  
  // Format time as 2025 date
  const formatTimeAs2025Date = (timeValue?: number) => {
    if (timeValue === undefined) return 'Unknown';
    
    // Start date: January 1, 2025
    const baseDate = new Date('2025-01-01T00:00:00');
    
    // Add the seconds from the timeValue to create a date in 2025
    const secondsInYear = 365 * 24 * 60 * 60;
    const secondsToAdd = timeValue % secondsInYear;
    
    const resultDate = new Date(baseDate.getTime() + (secondsToAdd * 1000));
    
    return resultDate.toLocaleString();
  };

  // Get fraud reason
  const getFraudReason = (transaction: Transaction, index: number): string => {
    if (transaction.Class === 1) {
      return "Known fraudulent pattern";
    }
    
    if (index < predictions.length) {
      const prediction = predictions[index];
      if (prediction.logistic === 1) return "Logistic Regression detected fraud";
      if (prediction.random_forest === 1) return "Random Forest detected fraud";
      if (prediction.xgboost === 1) return "XGBoost detected fraud";
    }
    
    if (transaction.V1 !== undefined && transaction.V1 < -3) {
      return "Suspicious transaction pattern (V1 anomaly)";
    }
    
    if (transaction.Amount !== undefined && transaction.Amount > 1000) {
      return "Unusually large transaction amount";
    }
    
    return "Multiple fraud indicators";
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 bg-gray-100 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Fraud Alerts</h2>
      </div>
      <div className="p-4">
        <div className="h-[300px] overflow-y-auto">
          {fraudulentTransactions.length === 0 ? (
            <p className="text-gray-600">No fraudulent transactions detected.</p>
          ) : (
            fraudulentTransactions.map((transaction, index) => {
              const originalIndex = transactions.indexOf(transaction);
              
              return (
                <div key={transaction.transaction_id || index} className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-red-800">Fraudulent Transaction Detected</p>
                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                      High Risk
                    </span>
                  </div>
                  
                  <div className="mt-2 space-y-1">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">ID:</span> {transaction.transaction_id || `Unknown-${index}`}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Time:</span> {formatTimeAs2025Date(transaction.Time)}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Amount:</span> ${transaction.Amount !== undefined ? transaction.Amount.toFixed(2) : '0.00'}
                    </p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Reason:</span> {getFraudReason(transaction, originalIndex)}
                    </p>
                  </div>
                  
                  {/* Show model confidence if prediction exists */}
                  {originalIndex < predictions.length && (
                    <div className="mt-2 pt-2 border-t border-red-200">
                      <p className="text-xs font-medium text-gray-600">Model confidence:</p>
                      <div className="flex space-x-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${predictions[originalIndex].logistic === 1 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                          Logistic: {predictions[originalIndex].logistic === 1 ? 'Fraud' : 'OK'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${predictions[originalIndex].random_forest === 1 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                          RF: {predictions[originalIndex].random_forest === 1 ? 'Fraud' : 'OK'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${predictions[originalIndex].xgboost === 1 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                          XGBoost: {predictions[originalIndex].xgboost === 1 ? 'Fraud' : 'OK'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default FraudAlerts;