import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | number) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatOnlyDate(date: Date | string | number) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatNumber(value: string | number) {
  if (value === undefined || value === null || value === '') return '';
  const num = typeof value === 'string' ? parseFloat(value.replace(/[^0-9.-]+/g, "")) : value;
  if (isNaN(num)) return value.toString();
  return new Intl.NumberFormat('vi-VN').format(num);
}
