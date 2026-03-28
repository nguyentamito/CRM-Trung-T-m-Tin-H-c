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

export function numberToVietnameseWords(number: number): string {
  if (number === 0) return "Không đồng";
  
  const units = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const levels = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  
  function readThreeDigits(n: number, showZero: boolean): string {
    let res = "";
    const hundred = Math.floor(n / 100);
    const ten = Math.floor((n % 100) / 10);
    const unit = n % 10;
    
    if (hundred > 0 || showZero) {
      res += units[hundred] + " trăm ";
    }
    
    if (ten > 1) {
      res += units[ten] + " mươi ";
      if (unit === 1) res += "mốt";
      else if (unit === 5) res += "lăm";
      else if (unit > 0) res += units[unit];
    } else if (ten === 1) {
      res += "mười ";
      if (unit === 5) res += "lăm";
      else if (unit > 0) res += units[unit];
    } else if (ten === 0 && unit > 0) {
      if (hundred > 0 || showZero) res += "lẻ ";
      res += units[unit];
    }
    
    return res.trim();
  }
  
  let res = "";
  let levelIdx = 0;
  let temp = number;
  
  while (temp > 0) {
    const threeDigits = temp % 1000;
    if (threeDigits > 0) {
      const s = readThreeDigits(threeDigits, temp >= 1000);
      res = s + " " + levels[levelIdx] + " " + res;
    }
    temp = Math.floor(temp / 1000);
    levelIdx++;
  }
  
  res = res.trim();
  if (res.endsWith(" mươi một")) res = res.replace(" mươi một", " mươi mốt");
  
  return res.charAt(0).toUpperCase() + res.slice(1) + " đồng";
}
