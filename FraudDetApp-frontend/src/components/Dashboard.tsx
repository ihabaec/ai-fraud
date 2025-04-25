import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Using original component names
import MetricsSummary from './MetricsSummary';
import RealTimeChart from './RealTimeChart_1';
import TransactionHistory from './TransactionHistory';
import FraudAlerts from './FraudAlerts';
import TransactionDetails from './TransactionDetails';
import { Transaction, Prediction, Metrics } from '../types/types';

const FraudDetectionDashboard: React.FC = () => {
  // State management using original state variable names
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [stats, setStats] = useState({
    total: 0,
    flagged: 0,
    recentVolume: 0
  });
  
  // Connection management with retry logic
  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    
    const connectToServer = () => {
      setConnectionStatus('connecting');
      const socket = new WebSocket("ws://localhost:8000/ws/fraud_detection/");
      
      socket.onopen = (event) => {
        console.log("WebSocket connection opened", event);
        setConnectionStatus('connected');
        reconnectAttempts = 0;
      };
      
      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("WebSocket message received:", data);
        
        // Check if we have a "message" field (connection confirmation)
        if (data.message) {
          console.log("Connection message:", data.message);
          return;
        }
        
        // Check if we received a prediction result
        if (data.predictions && data.transaction) {
          console.log("Adding new transaction:", data.transaction);
          console.log("With prediction:", data.predictions);
          
          // Use functional updates to ensure state is correctly updated
          setPredictions(prev => [...prev, data.predictions]);
          setTransactions(prev => [...prev, data.transaction]);
          
          // Update statistics
          setStats(prevStats => {
            const isFraudulent = isFlaggedAsFraud(data.predictions);
            return {
              total: prevStats.total + 1,
              flagged: isFraudulent ? prevStats.flagged + 1 : prevStats.flagged,
              recentVolume: prevStats.recentVolume + (data.transaction.Amount * 10 || 0)
            };
          });
        } else if (data.prediction) {
          // Handle the format where it's just "prediction" (not "predictions")
          console.log("Adding new prediction:", data.prediction);
          setPredictions(prev => [...prev, data.prediction]);
          
          // If there's transaction data available
          if (data.transaction) {
            setTransactions(prev => [...prev, data.transaction]);
            
            // Update statistics
            setStats(prevStats => {
              const isFraudulent = isFlaggedAsFraud(data.prediction);
              return {
                total: prevStats.total + 1,
                flagged: isFraudulent ? prevStats.flagged + 1 : prevStats.flagged,
                recentVolume: prevStats.recentVolume + (data.transaction.Amount || 0)
              };
            });
          }
        }
      };
      
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus('disconnected');
      };
      
      socket.onclose = (event) => {
        console.log("WebSocket connection closed:", event);
        setConnectionStatus('disconnected');
        
        // Implement exponential backoff for reconnection
        if (reconnectAttempts < maxReconnectAttempts) {
          const timeout = Math.pow(2, reconnectAttempts) * 1000;
          console.log(`Attempting reconnection in ${timeout/1000} seconds...`);
          
          setTimeout(() => {
            reconnectAttempts++;
            connectToServer();
          }, timeout);
        } else {
          console.error("Maximum reconnection attempts reached");
        }
      };
      
      return socket;
    };
    
    const socket = connectToServer();
    
    return () => {
      socket.close();
    };
  }, []);
  
  // Helper function to determine if a transaction is flagged as fraud
  const isFlaggedAsFraud = (prediction: Prediction) => {
    if (!prediction) return false;
    return prediction.xgboost === 1 || 
           prediction.random_forest === 1 || 
           prediction.logistic === 1;
  };
  
  // Event handlers
  const handleSelectTransaction = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsModalOpen(true);
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedTransaction(null);
  };
  
  // Calculate metrics based on current state, using original metrics structure
  const metrics: Metrics = {
    totalTransactions: transactions.length,
    fraudulentTransactions: predictions.filter(p => 
      p.xgboost === 1 || p.random_forest === 1 || p.logistic === 1
    ).length,
    accuracies: {
      logistic: 0.85,
      random_forest: 0.92,
      xgboost: 0.95
    }
  };
  
  // Prepare data for model comparison chart
  const modelData = [
    { name: 'Logistic Reg.', accuracy: metrics.accuracies.logistic, color: '#8884d8' },
    { name: 'Random Forest', accuracy: metrics.accuracies.random_forest, color: '#82ca9d' },
    { name: 'XGBoost', accuracy: metrics.accuracies.xgboost, color: '#ffc658' }
  ];
  
  // Get high risk transactions
  const highRiskTransactions = transactions
    .map((transaction, index) => ({
      transaction,
      prediction: predictions[index]
    }))
    .filter(item => isFlaggedAsFraud(item.prediction))
    .slice(0, 5);
  
  return (
    <div className="bg-slate-50 min-h-screen">
      <header className="bg-blue-500 text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Fraud Detection Dashboard</h1>
            <p className="text-sm font-light">Real-time transaction monitoring system</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
            connectionStatus === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
            'bg-red-100 text-red-800'
          }`}>
            {connectionStatus === 'connected' ? 'Connected' :
            connectionStatus === 'connecting' ? 'Connecting...' :
            'Disconnected'}
          </div>
        </div>
      </header>
      
      <main className="container mx-auto p-4">
        {/* Dashboard Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-gray-500 text-sm font-medium mb-2">Total Transactions</h3>
            <p className="text-3xl font-bold">{metrics.totalTransactions}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-gray-500 text-sm font-medium mb-2">Fraudulent Transactions</h3>
            <p className="text-3xl font-bold text-red-600">{metrics.fraudulentTransactions}</p>
            <p className="text-sm text-gray-500">
              {metrics.totalTransactions > 0 ? `${((metrics.fraudulentTransactions / metrics.totalTransactions) * 100).toFixed(1)}%` : '0%'} Fraud Rate
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-gray-500 text-sm font-medium mb-2">Transaction Volume</h3>
            <p className="text-3xl font-bold">
              {stats.recentVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })} MAD
            </p>
          </div>
        </div>
        
        {/* Main Dashboard Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Charts & Transaction History */}
          <div className="lg:col-span-3">
            
            <RealTimeChart predictions={predictions} transactions={transactions} />
            
            <div className="bg-white rounded-lg shadow mt-6">
              <div className="border-b p-4 flex justify-between items-center">
                <h2 className="font-semibold text-lg">Transaction History</h2>
                <span className="text-sm text-gray-500">
                  {transactions.length} transactions recorded
                </span>
              </div>
              <TransactionHistory 
                transactions={transactions}
                predictions={predictions}
                onSelectTransaction={handleSelectTransaction} 
              />
            </div>
          </div>
          
          {/* Right Column - Alerts & Model Overview */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="border-b p-4">
                <h2 className="font-semibold text-lg">Fraud Alerts</h2>
              </div>
              <FraudAlerts 
                transactions={transactions} 
                predictions={predictions} 
              />
            </div>
            
            <div className="bg-white rounded-lg shadow mt-6">
              <div className="border-b p-4">
                <h2 className="font-semibold text-lg">Detection Model Overview</h2>
              </div>
              <div className="p-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Logistic Regression</span>
                    <span className="text-sm">{(metrics.accuracies.logistic * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${metrics.accuracies.logistic * 100}%` }}></div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Random Forest</span>
                    <span className="text-sm">{(metrics.accuracies.random_forest * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${metrics.accuracies.random_forest * 100}%` }}></div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">XGBoost</span>
                    <span className="text-sm">{(metrics.accuracies.xgboost * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className="bg-purple-500 h-2.5 rounded-full" style={{ width: `${metrics.accuracies.xgboost * 100}%` }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Transaction Details Modal or Section */}
      {selectedTransaction && predictions.length > 0 && (
        isModalOpen ? (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-auto">
              <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-xl font-bold">Transaction Details</h2>
                <button onClick={closeModal} className="text-gray-500 hover:text-gray-800">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-6">
                <TransactionDetails 
                  transaction={selectedTransaction} 
                  prediction={predictions[transactions.indexOf(selectedTransaction)]} 
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <TransactionDetails 
              transaction={selectedTransaction} 
              prediction={predictions[transactions.indexOf(selectedTransaction)]} 
            />
          </div>
        )
      )}
    </div>
  );
};

export default FraudDetectionDashboard;