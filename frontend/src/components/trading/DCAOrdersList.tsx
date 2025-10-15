'use client';

import React from 'react';
import { Clock, TrendingUp, Pause, Play, X, Calendar } from 'lucide-react';
import type { DCAOrder } from '@/types';
import { pauseDCAOrder, resumeDCAOrder, cancelDCAOrder } from '@/lib/api';

interface DCAOrdersListProps {
  orders: DCAOrder[];
  onUpdate: () => void;
}

export default function DCAOrdersList({ orders, onUpdate }: DCAOrdersListProps) {
  const [loading, setLoading] = React.useState<string | null>(null);

  // Filter to only show active and paused orders
  const activeOrders = orders.filter(order =>
    order.status === 'active' || order.status === 'paused'
  );

  const handlePause = async (orderId: string) => {
    setLoading(orderId);
    try {
      const success = await pauseDCAOrder(orderId);
      if (success) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error pausing DCA order:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleResume = async (orderId: string) => {
    setLoading(orderId);
    try {
      const success = await resumeDCAOrder(orderId);
      if (success) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error resuming DCA order:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this DCA order?')) {
      return;
    }

    setLoading(orderId);
    try {
      const success = await cancelDCAOrder(orderId);
      if (success) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error cancelling DCA order:', error);
    } finally {
      setLoading(null);
    }
  };

  const getProgress = (order: DCAOrder) => {
    return (order.currentBuy / order.numberOfBuys) * 100;
  };

  const getTimeRemaining = (order: DCAOrder) => {
    if (!order.nextBuyAt || order.status !== 'active') return null;

    const now = Date.now();
    const diff = order.nextBuyAt - now;

    if (diff <= 0) return 'Ready';

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const getTotalSpent = (order: DCAOrder) => {
    return order.completedBuys.reduce((sum, buy) => sum + buy.solAmount, 0);
  };

  const getStrategyLabel = (type: string) => {
    switch (type) {
      case 'time-based': return '⏰ Time-based';
      case 'price-based': return '📊 Price-based';
      default: return type;
    }
  };

  if (activeOrders.length === 0) {
    return (
      <div className="bg-black/40 backdrop-blur-md rounded-xl p-3 border border-gray-800">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-400">DCA Orders</h3>
          <span className="text-xs text-gray-500 ml-auto">No active orders</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-xl p-6 border border-gray-800">
      <h3 className="text-lg font-semibold text-white mb-4">DCA Orders ({activeOrders.length})</h3>

      <div className="space-y-3">
        {activeOrders.map((order) => (
          <div
            key={order.id}
            className="bg-gray-900/50 rounded-lg p-4 border border-gray-700"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">
                    {order.tokenSymbol || `${order.tokenMint.slice(0, 8)}...`}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    order.status === 'active' ? 'bg-green-900/30 text-green-400' :
                    order.status === 'paused' ? 'bg-yellow-900/30 text-yellow-400' :
                    order.status === 'completed' ? 'bg-blue-900/30 text-blue-400' :
                    'bg-gray-900/30 text-gray-400'
                  }`}>
                    {order.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {getStrategyLabel(order.strategyType)} • Exit: {order.exitStrategy}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-1">
                {order.status === 'active' && (
                  <button
                    onClick={() => handlePause(order.id)}
                    disabled={loading === order.id}
                    className="p-1.5 hover:bg-gray-800 rounded text-yellow-400 disabled:opacity-50"
                    title="Pause"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                )}

                {order.status === 'paused' && (
                  <button
                    onClick={() => handleResume(order.id)}
                    disabled={loading === order.id}
                    className="p-1.5 hover:bg-gray-800 rounded text-green-400 disabled:opacity-50"
                    title="Resume"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}

                {(order.status === 'active' || order.status === 'paused') && (
                  <button
                    onClick={() => handleCancel(order.id)}
                    disabled={loading === order.id}
                    className="p-1.5 hover:bg-gray-800 rounded text-red-400 disabled:opacity-50"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Progress: {order.currentBuy} / {order.numberOfBuys} buys</span>
                <span>{getProgress(order).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                  style={{ width: `${getProgress(order)}%` }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-gray-400">Total Budget</p>
                <p className="text-white font-semibold">{order.totalSolAmount.toFixed(4)} SOL</p>
              </div>
              <div>
                <p className="text-gray-400">Spent</p>
                <p className="text-white font-semibold">{getTotalSpent(order).toFixed(4)} SOL</p>
              </div>
              <div>
                <p className="text-gray-400">Interval</p>
                <p className="text-white font-semibold">{order.intervalMinutes}m</p>
              </div>
              <div>
                <p className="text-gray-400">Next Buy</p>
                <p className={`font-semibold ${
                  getTimeRemaining(order) === 'Ready' ? 'text-green-400' : 'text-white'
                }`}>
                  {getTimeRemaining(order) || 'N/A'}
                </p>
              </div>
            </div>

            {/* Created timestamp */}
            <div className="mt-2 pt-2 border-t border-gray-700">
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Created: {new Date(order.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
