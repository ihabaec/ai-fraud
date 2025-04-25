import React, { useState } from 'react';
import { Transaction, Prediction } from '../types/types';

interface TransactionHistoryProps {
  transactions: Transaction[];
  predictions: Prediction[]; // Add predictions to props
  onSelectTransaction: (transaction: Transaction) => void;
}

const TransactionHistory: React.FC<TransactionHistoryProps> = ({ 
  transactions, 
  predictions, 
  onSelectTransaction 
}) => {
  const [sortField, setSortField] = useState<'Time' | 'Amount'>('Time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const sortedTransactions = [...transactions].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    // Handle undefined values
    if (aValue === undefined && bValue === undefined) return 0;
    if (aValue === undefined) return sortDirection === 'asc' ? -1 : 1;
    if (bValue === undefined) return sortDirection === 'asc' ? 1 : -1;
    
    // Regular comparison
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);
  const paginatedTransactions = sortedTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: 'Time' | 'Amount') => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Function to format time as 2025 date
  const formatTimeAs2025Date = (timeValue?: number) => {
    if (timeValue === undefined) return 'Unknown';
    
    // Start date: January 1, 2025
    const baseDate = new Date('2025-01-01T00:00:00');
    
    // Add the seconds from the timeValue to create a date in 2025
    // We'll use modulo to ensure we stay within 2025 if the values are very large
    const secondsInYear = 365 * 24 * 60 * 60;
    const secondsToAdd = timeValue % secondsInYear;
    
    const resultDate = new Date(baseDate.getTime() + (secondsToAdd * 1000));
    
    return resultDate.toLocaleString();
  };

  // Function to determine if a transaction is fraudulent based on the prediction
  const isFraudulent = (transaction: Transaction, index: number) => {
    // First check if there's an explicit Class value
    if (transaction.Class === 1) {
      return true;
    }
    
    // Then check the prediction if available
    if (index < predictions.length) {
      const prediction = predictions[index];
      // If any model predicts fraud, consider it fraudulent
      return prediction.logistic === 1 || prediction.random_forest === 1 || prediction.xgboost === 1;
    }
    
    // If no prediction is available or no explicit Class, check for other fraud indicators
    // Use optional chaining to handle possibly undefined properties
    return (transaction.V1 !== undefined && transaction.V1 < -3) || 
           (transaction.Amount !== undefined && transaction.Amount > 1000);
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <h2 className="text-lg font-semibold p-4 bg-gray-100 border-b border-gray-200">Transaction History</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('Time')}
              >
                Time {sortField === 'Time' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSort('Amount')}
              >
                Amount {sortField === 'Amount' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedTransactions.map((transaction, index) => {
              const transactionIndex = transactions.indexOf(transaction);
              const fraudulent = isFraudulent(transaction, transactionIndex);
              
              return (
                <tr 
                  key={transaction.transaction_id || index} 
                  className={`${fraudulent ? 'bg-red-50' : ''} hover:bg-gray-50`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTimeAs2025Date(transaction.Time)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${transaction.Amount !== undefined ? transaction.Amount.toFixed(2) : '0.00'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {fraudulent ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        Fraudulent
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Legitimate
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button 
                      className="bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200"
                      onClick={() => onSelectTransaction(transaction)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between items-center p-4 bg-gray-50 border-t border-gray-200">
        <button 
          className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        >
          Previous
        </button>
        <span className="text-sm text-gray-700">
          Page {currentPage} of {Math.max(totalPages, 1)}
        </span>
        <button 
          className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages || totalPages === 0}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default TransactionHistory;