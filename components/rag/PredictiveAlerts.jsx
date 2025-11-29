"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  TrendingDown,
  AlertCircle,
  Activity,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function PredictiveAlerts() {
  const [forecast, setForecast] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetchForecast();
  }, []);

  const fetchForecast = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/RythmIQ-ai/predict");
      const data = await response.json();

      if (data.success) {
        setForecast(data.forecast);
        setPatterns(data.patterns);
        generateChartData(data.forecast, data.patterns);
      } else {
        toast.error("Failed to generate forecast");
      }
    } catch (error) {
      console.error("Error fetching forecast:", error);
      toast.error("Failed to load forecast");
    } finally {
      setIsLoading(false);
    }
  };

  const generateChartData = (forecast, patterns) => {
    // Generate 30-day projection
    const data = [];
    const startBalance = 0; // Relative to today
    const dailyAverage = patterns?.weeklyAverage / 7 || 100;

    for (let day = 0; day <= 30; day++) {
      const projectedBalance = startBalance + (patterns?.monthlyAverage || 0) / 30 * day - dailyAverage * day;
      data.push({
        day,
        balance: Math.max(0, projectedBalance),
        safeThreshold: 1000,
      });
    }

    setChartData(data);
  };

  const getRiskColor = (level) => {
    switch (level) {
      case "critical":
        return "bg-red-50 border-red-200 text-red-900";
      case "high":
        return "bg-orange-50 border-orange-200 text-orange-900";
      case "medium":
        return "bg-yellow-50 border-yellow-200 text-yellow-900";
      case "low":
        return "bg-green-50 border-green-200 text-green-900";
      default:
        return "bg-gray-50 border-gray-200 text-gray-900";
    }
  };

  const getRiskIcon = (level) => {
    switch (level) {
      case "critical":
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case "high":
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case "medium":
        return <Activity className="h-5 w-5 text-yellow-600" />;
      case "low":
        return <TrendingDown className="h-5 w-5 text-green-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (!forecast) {
    return (
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Unable to generate forecast. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Risk Level Card */}
      <div className={`rounded-lg border p-6 ${getRiskColor(forecast.risk_level)}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {getRiskIcon(forecast.risk_level)}
            <div>
              <h3 className="font-semibold capitalize">
                {forecast.risk_level} Risk
              </h3>
              <p className="text-sm mt-1">{forecast.summary}</p>
            </div>
          </div>
          <button
            onClick={fetchForecast}
            className="text-sm opacity-75 hover:opacity-100"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-white bg-opacity-50 rounded p-3">
            <p className="text-xs opacity-75">Predicted 30-Day Balance</p>
            <p className="text-lg font-bold mt-1">
              ${forecast.predicted_balance_day_30?.toFixed(0) || 0}
            </p>
          </div>
          <div className="bg-white bg-opacity-50 rounded p-3">
            <p className="text-xs opacity-75">Forecast Confidence</p>
            <p className="text-lg font-bold mt-1">{forecast.confidence}%</p>
          </div>
        </div>
      </div>

      {/* 30-Day Forecast Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h3 className="font-semibold mb-4">30-Day Balance Projection</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                label={{ value: "Days", position: "insideRight", offset: -5 }}
              />
              <YAxis label={{ value: "Balance ($)", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={(value) => `$${value.toFixed(0)}`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#3b82f6"
                dot={false}
                name="Projected Balance"
              />
              <Line
                type="monotone"
                dataKey="safeThreshold"
                stroke="#ef4444"
                strokeDasharray="5 5"
                dot={false}
                name="Safety Threshold"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Critical Dates */}
      {forecast.critical_dates && forecast.critical_dates.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            Critical Dates
          </h3>
          <div className="space-y-3">
            {forecast.critical_dates.map((date, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-red-50 rounded border border-red-200">
                <div className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded">
                  Day {date.day}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900">{date.reason}</p>
                  <p className="text-xs text-red-700 mt-1">
                    Predicted balance: ${date.predicted_balance?.toFixed(0) || 0}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Actions */}
      {forecast.recommended_actions && forecast.recommended_actions.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h3 className="font-semibold mb-4">Recommended Actions</h3>
          <div className="space-y-2">
            {forecast.recommended_actions.map((action, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-blue-50 rounded border border-blue-200">
                <div className="text-blue-600 font-bold text-sm pt-1">{idx + 1}</div>
                <p className="text-sm text-blue-900">{action}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spending Patterns */}
      {patterns && (
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <h3 className="font-semibold mb-4">Historical Spending Patterns</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded">
              <p className="text-xs text-gray-600">Weekly Average</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${patterns.weeklyAverage}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded">
              <p className="text-xs text-gray-600">Monthly Average</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                ${patterns.monthlyAverage}
              </p>
            </div>
          </div>
          {patterns.topCategories && patterns.topCategories.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-gray-600 mb-2">Top Spending Categories</p>
              <div className="space-y-2">
                {patterns.topCategories.map((cat, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">{cat.category}</span>
                    <span className="font-semibold text-gray-900">${cat.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
