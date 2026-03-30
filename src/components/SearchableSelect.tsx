import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface Option {
  id: string | number;
  label: string;
  subLabel?: string;
  sublabel?: string; // Support both cases
  disabled?: boolean;
  value?: any;
}

interface SearchableSelectProps {
  options: Option[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Chọn một mục...",
  disabled = false,
  className = "",
  clearable = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(opt => String(opt.id) === String(value));

  const getSubLabel = (opt: Option) => opt.subLabel || opt.sublabel;

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (getSubLabel(opt) && getSubLabel(opt)!.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleSelect = (option: Option) => {
    if (option.disabled) return;
    onChange(option.id);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full px-4 py-2 bg-white border rounded-lg cursor-pointer transition-all min-h-[42px]",
          isOpen ? "border-[#2D5A4C] ring-2 ring-[#2D5A4C]/10" : "border-gray-200 hover:border-[#2D5A4C]",
          disabled && "bg-gray-50 cursor-not-allowed opacity-60"
        )}
      >
        <div className="flex-1 truncate">
          {selectedOption ? (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">{selectedOption.label}</span>
              {getSubLabel(selectedOption) && (
                <span className="text-xs text-gray-500">{getSubLabel(selectedOption)}</span>
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-400">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {clearable && value && !disabled && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown 
            size={18} 
            className={cn("text-gray-400 transition-transform", isOpen && "rotate-180")} 
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="p-2 border-b border-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                ref={inputRef}
                type="text"
                className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border-none rounded-lg focus:ring-0"
                placeholder="Tìm kiếm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  onClick={() => handleSelect(option)}
                  className={cn(
                    "px-4 py-2 transition-colors",
                    option.disabled ? "opacity-40 cursor-not-allowed bg-gray-50" : "cursor-pointer hover:bg-gray-50",
                    String(option.id) === String(value) && "bg-[#2D5A4C]/5 text-[#2D5A4C]"
                  )}
                >
                  <div className="text-sm font-medium">{option.label}</div>
                  {getSubLabel(option) && (
                    <div className="text-xs text-gray-500">{getSubLabel(option)}</div>
                  )}
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                Không tìm thấy kết quả
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
