import React, { useEffect, useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Transaction, Prediction } from '../types/types';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
  annotationPlugin
);

interface RealTimeChartProps {
  predictions: Prediction[];
  transactions: Transaction[];
}

const RealTimeChart: React.FC<RealTimeChartProps> = ({ predictions, transactions }) => {
  const [chartData, setChartData] = useState<any>(null);
  const [insights, setInsights] = useState<string[]>([]);

  useEffect(() => {
    if (transactions.length === 0 || predictions.length === 0) return;

    // Format time as 2025 date instead of using 1970 epoch
    const formatTimeAs2025Date = (timeValue?: number) => {
      if (timeValue === undefined) return 'Unknown';
      
      // Start date: January 1, 2025
      const baseDate = new Date('2025-01-01T00:00:00');
      
      // Add the seconds from the timeValue to create a date in 2025
      const secondsInYear = 365 * 24 * 60 * 60;
      const secondsToAdd = timeValue % secondsInYear;
      
      const resultDate = new Date(baseDate.getTime() + (secondsToAdd * 1000));
      
      return resultDate.toLocaleTimeString();
    };

    const labels = transactions.map(t => t.Time ? formatTimeAs2025Date(t.Time) : `TX-${transactions.indexOf(t)}`);
    const amounts = transactions.map(t => t.Amount || 0);

    // Determine fraud status using predictions (not just Class)
    const fraudStatus = transactions.map((_, i) => {
      if (i < predictions.length) {
        const pred = predictions[i];
        return (pred.logistic === 1 || pred.random_forest === 1 || pred.xgboost === 1);
      }
      return false;
    });

    // Identify anomalies
    const anomalies = identifyAnomalies(amounts);

    // Calculate insights
    const newInsights = calculateInsights(transactions, predictions, fraudStatus, anomalies);
    setInsights(newInsights);

    setChartData({
      labels,
      datasets: [
        {
          type: 'line' as const,
          label: 'Logistic Regression',
          data: predictions.map(p => p.logistic),
          borderColor: 'rgb(255, 99, 132)',
          yAxisID: 'y',
        },
        {
          type: 'line' as const,
          label: 'Random Forest',
          data: predictions.map(p => p.random_forest),
          borderColor: 'rgb(54, 162, 235)',
          yAxisID: 'y',
        },
        {
          type: 'line' as const,
          label: 'XGBoost',
          data: predictions.map(p => p.xgboost),
          borderColor: 'rgb(75, 192, 192)',
          yAxisID: 'y',
        },
        {
          type: 'bar' as const,
          label: 'Transaction Amount',
          data: amounts,
          backgroundColor: amounts.map((_, i) => 
            fraudStatus[i] 
              ? 'rgba(255, 99, 132, 0.5)' 
              : anomalies[i] 
                ? 'rgba(255, 206, 86, 0.5)'
                : 'rgba(75, 192, 192, 0.5)'
          ),
          yAxisID: 'y1',
        },
      ],
    });
  }, [predictions, transactions]);

  const options = {
    responsive: true,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Fraud Probability',
        },
        min: 0,
        max: 1,
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Transaction Amount',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
    plugins: {
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: 'xy' as const,
        },
        pan: {
          enabled: true,
          mode: 'xy' as const,
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const datasetLabel = context.dataset.label;
            const value = context.parsed.y;
            const index = context.dataIndex;
            
            // Safely determine fraud status
            let fraudStatus = 'Unknown';
            if (index < transactions.length) {
              if (index < predictions.length) {
                const pred = predictions[index];
                fraudStatus = (pred.logistic === 1 || pred.random_forest === 1 || pred.xgboost === 1) 
                  ? 'Fraudulent' : 'Legitimate';
              } else if (transactions[index].Class === 1) {
                fraudStatus = 'Fraudulent';
              } else {
                fraudStatus = 'Legitimate';
              }
            }
            
            const isAnomaly = index < transactions.length ? 
              identifyAnomalies(transactions.map(t => t.Amount || 0))[index] : false;
              
            return `${datasetLabel}: ${value.toFixed(2)} (${fraudStatus}${isAnomaly ? ', Anomaly' : ''})`;
          },
        },
      },
    },
  };

  const identifyAnomalies = (amounts: number[]) => {
    if (amounts.length === 0) return [];
    
    const validAmounts = amounts.filter(amount => !isNaN(amount));
    if (validAmounts.length === 0) return amounts.map(() => false);
    
    const mean = validAmounts.reduce((sum, amount) => sum + amount, 0) / validAmounts.length;
    const stdDev = Math.sqrt(
      validAmounts.reduce((sum, amount) => sum + Math.pow(amount - mean, 2), 0) / validAmounts.length
    );
    const threshold = mean + 2 * stdDev; // Lower to 2 std devs to catch more anomalies

    return amounts.map(amount => amount > threshold);
  };

  const calculateInsights = (
    transactions: Transaction[], 
    predictions: Prediction[], 
    fraudStatus: boolean[],
    anomalies: boolean[]
  ) => {
    // Count fraudulent transactions based on predictions
    const fraudCount = fraudStatus.filter(Boolean).length;
    const fraudRate = transactions.length > 0 ? (fraudCount / transactions.length) * 100 : 0;
    
    // Calculate average and max amounts with proper checking
    const validAmounts = transactions
      .map(t => t.Amount)
      .filter((amount): amount is number => amount !== undefined && !isNaN(amount));
      
    const averageAmount = validAmounts.length > 0 
      ? validAmounts.reduce((sum, amount) => sum + amount, 0) / validAmounts.length 
      : 0;
      
    const maxAmount = validAmounts.length > 0 
      ? Math.max(...validAmounts) 
      : 0;
      
    const anomalyCount = anomalies.filter(Boolean).length;

    // Calculate model detection rates (not accuracies)
    const modelDetections = {
      logistic: predictions.filter(p => p.logistic === 1).length,
      random_forest: predictions.filter(p => p.random_forest === 1).length,
      xgboost: predictions.filter(p => p.xgboost === 1).length,
    };
    
    const totalPredictions = predictions.length;
    const logisticRate = totalPredictions > 0 ? (modelDetections.logistic / totalPredictions) * 100 : 0;
    const rfRate = totalPredictions > 0 ? (modelDetections.random_forest / totalPredictions) * 100 : 0;
    const xgboostRate = totalPredictions > 0 ? (modelDetections.xgboost / totalPredictions) * 100 : 0;

    return [
      `Fraud Rate: ${fraudRate.toFixed(2)}%`,
      `Average Transaction Amount: $${averageAmount.toFixed(2)}`,
      `Highest Transaction Amount: $${maxAmount.toFixed(2)}`,
    ];
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h2 className="text-lg font-semibold mb-4">Real-Time Fraud Detection</h2>
      
      {transactions.length === 0 || predictions.length === 0 ? (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded">
          <p className="text-gray-500">Waiting for transaction data...</p>
        </div>
      ) : chartData ? (
        <Chart type="bar" data={chartData} options={options} />
      ) : (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded">
          <p className="text-gray-500">Preparing chart...</p>
        </div>
      )}
      
      <div className="mt-4">
        <h3 className="text-md font-semibold mb-2">Insights:</h3>
        {insights.length > 0 ? (
          <ul className="list-disc pl-5">
            {insights.map((insight, index) => (
              <li key={index} className="text-sm text-gray-600">{insight}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">No insights available yet.</p>
        )}
      </div>
      
      <div className="mt-4 flex justify-between text-sm">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-[rgba(75,192,192,0.5)] mr-2"></div>
          <span>Normal Transaction</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-[rgba(255,206,86,0.5)] mr-2"></div>
          <span>Anomaly</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-[rgba(255,99,132,0.5)] mr-2"></div>
          <span>Fraudulent</span>
        </div>
      </div>
    </div>
  );
};

export default RealTimeChart;