import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(date) {
  return new Date(date).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD'
  }).format(amount);
}

export function formatPhone(phone) {
  if (!phone) return '';
  return phone.replace(/(\d{4})(\d{3})(\d{3})/, '$1-$2-$3');
}

export function getStatusColor(status) {
  switch (status) {
    case 'idle':
      return 'status-idle';
    case 'busy':
      return 'status-busy';
    case 'offline':
      return 'status-offline';
    case 'completed':
      return 'status-completed';
    case 'requested':
      return 'status-pending';
    case 'assigned':
      return 'status-pending';
    case 'accepted':
      return 'status-pending';
    case 'enroute':
      return 'status-pending';
    case 'arrived':
      return 'status-pending';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

export function getStatusText(status) {
  switch (status) {
    case 'idle':
      return '閒置';
    case 'busy':
      return '忙碌';
    case 'offline':
      return '離線';
    case 'completed':
      return '已完成';
    case 'requested':
      return '已請求';
    case 'assigned':
      return '已指派';
    case 'accepted':
      return '已接受';
    case 'enroute':
      return '前往中';
    case 'arrived':
      return '已到達';
    default:
      return '未知';
  }
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}
