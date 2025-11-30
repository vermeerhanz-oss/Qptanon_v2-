import { format } from 'date-fns';

/**
 * Export data to CSV file
 * @param {Object} options
 * @param {string} options.filename - Filename without extension
 * @param {Array<{key: string, label: string}>} options.columns - Column definitions
 * @param {Array<Object>} options.rows - Data rows (objects with keys matching column keys)
 */
export function exportToCsv({ filename, columns, rows }) {
  const headers = columns.map(col => col.label);
  
  const csvRows = rows.map(row => 
    columns.map(col => {
      const value = row[col.key];
      // Handle null/undefined
      if (value === null || value === undefined) return '';
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  );

  const csvContent = [headers.join(','), ...csvRows].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}