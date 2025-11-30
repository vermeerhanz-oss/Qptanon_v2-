import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Loader2, AlertTriangle, UserCheck, UserX, Copy } from 'lucide-react';
import { classifyDuplicateScenario } from '@/components/utils/employeeDuplicates';

const Employee = base44.entities.Employee;
const Department = base44.entities.Department;
const Location = base44.entities.Location;

// Simple CSV parser
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of lines[i]) {
      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        inQuotes = false;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx]?.replace(/^["']|["']$/g, '') || '';
      });
      rows.push(row);
    }
  }
  
  return { headers, rows };
}

// Map spreadsheet columns to entity fields
function mapRowToEmployee(row) {
  return {
    first_name: row.firstName || row.first_name || '',
    last_name: row.lastName || row.last_name || '',
    preferred_name: row.preferredName || row.preferred_name || '',
    email: row.email || '',
    personal_email: row.personalEmail || row.personal_email || '',
    phone: row.phone || '',
    job_title: row.jobTitle || row.job_title || '',
    department_name: row.departmentName || row.department_name || row.department || '',
    location_name: row.locationName || row.location_name || row.location || '',
    employment_type: row.employmentType || row.employment_type || 'full_time',
    status: row.status || 'active',
    start_date: row.startDate || row.start_date || '',
    end_date: row.endDate || row.end_date || '',
  };
}

function validateRow(row) {
  const errors = [];
  if (!row.first_name) errors.push('firstName is required');
  if (!row.last_name) errors.push('lastName is required');
  if (!row.email) errors.push('email is required');
  if (!row.job_title) errors.push('jobTitle is required');
  if (!row.department_name) errors.push('departmentName is required');
  if (!row.start_date) errors.push('startDate is required');
  
  const validTypes = ['full_time', 'part_time', 'contractor'];
  if (row.employment_type && !validTypes.includes(row.employment_type)) {
    errors.push(`employmentType must be one of: ${validTypes.join(', ')}`);
  }
  
  const validStatuses = ['active', 'on_leave', 'terminated'];
  if (row.status && !validStatuses.includes(row.status)) {
    errors.push(`status must be one of: ${validStatuses.join(', ')}`);
  }
  
  return errors;
}

// Detect duplicates within file and against existing employees
async function detectDuplicates(mappedRows, existingEmployees) {
  // Build email frequency map for file duplicates
  const emailCount = {};
  mappedRows.forEach(row => {
    const email = row.email?.trim().toLowerCase();
    if (email) {
      emailCount[email] = (emailCount[email] || 0) + 1;
    }
  });

  // Build lookup maps for existing employees
  const existingByEmail = {};
  const existingByPersonalEmail = {};
  const existingByPhone = {};

  existingEmployees.forEach(emp => {
    if (emp.email) existingByEmail[emp.email.trim().toLowerCase()] = emp;
    if (emp.personal_email) existingByPersonalEmail[emp.personal_email.trim().toLowerCase()] = emp;
    if (emp.phone) existingByPhone[emp.phone.trim().replace(/\D/g, '')] = emp;
  });

  // Process each row
  return mappedRows.map((row, index) => {
    const email = row.email?.trim().toLowerCase();
    const personalEmail = row.personal_email?.trim().toLowerCase();
    const phone = row.phone?.trim().replace(/\D/g, '');

    // Check file duplicates
    const fileDuplicate = email && emailCount[email] > 1;

    // Check existing employee matches
    const matchingEmployees = [];
    
    if (email && existingByEmail[email]) {
      const match = existingByEmail[email];
      matchingEmployees.push({
        ...match,
        matchType: 'hard_email',
        statusCategory: match.status === 'terminated' ? 'terminated' : 'active',
      });
    }
    
    if (personalEmail && existingByPersonalEmail[personalEmail]) {
      const match = existingByPersonalEmail[personalEmail];
      const alreadyMatched = matchingEmployees.some(m => m.id === match.id);
      if (!alreadyMatched) {
        matchingEmployees.push({
          ...match,
          matchType: 'hard_personal_email',
          statusCategory: match.status === 'terminated' ? 'terminated' : 'active',
        });
      }
    }
    
    if (phone && existingByPhone[phone]) {
      const match = existingByPhone[phone];
      const alreadyMatched = matchingEmployees.some(m => m.id === match.id);
      if (!alreadyMatched) {
        matchingEmployees.push({
          ...match,
          matchType: 'hard_phone',
          statusCategory: match.status === 'terminated' ? 'terminated' : 'active',
        });
      }
    }

    const duplicateScenario = classifyDuplicateScenario(row, matchingEmployees);

    // Default import selection
    let importSelected = true;
    if (fileDuplicate) importSelected = false;
    if (duplicateScenario === 'hard_match_active') importSelected = false;

    return {
      ...row,
      _rowIndex: index,
      fileDuplicate,
      matchingEmployees,
      duplicateScenario,
      importSelected,
    };
  });
}

function getRowStatusDisplay(row) {
  if (row.fileDuplicate) {
    return { label: 'File Duplicate', variant: 'default', icon: Copy };
  }
  if (row.duplicateScenario === 'hard_match_active') {
    return { label: 'Duplicate (Active)', variant: 'danger', icon: UserX };
  }
  if (row.duplicateScenario === 'hard_match_terminated') {
    return { label: 'Duplicate (Terminated)', variant: 'warning', icon: AlertTriangle };
  }
  if (row.duplicateScenario === 'multiple_matches') {
    return { label: 'Multiple Matches', variant: 'warning', icon: AlertTriangle };
  }
  return { label: 'New', variant: 'success', icon: UserCheck };
}

export function EmployeeImportWizard({ onClose, onComplete }) {
  const [step, setStep] = useState('upload'); // upload, preview, importing, complete
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState({ headers: [], rows: [] });
  const [mappedRows, setMappedRows] = useState([]);
  const [existingDepartments, setExistingDepartments] = useState([]);
  const [existingLocations, setExistingLocations] = useState([]);
  const [newDepartments, setNewDepartments] = useState([]);
  const [importResults, setImportResults] = useState({ 
    successes: 0, 
    failures: [], 
    departmentsCreated: 0,
    skippedDuplicates: [],
  });
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = async (file) => {
    setError('');
    
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setFile(file);
    
    const text = await file.text();
    const parsed = parseCSV(text);
    
    if (parsed.rows.length === 0) {
      setError('No data found in file');
      return;
    }

    setParsedData(parsed);
    
    // Map rows to employee format
    const mapped = parsed.rows.map(row => mapRowToEmployee(row));
    
    // Load existing data
    const [depts, locs, existingEmps] = await Promise.all([
      Department.list(),
      Location.list(),
      Employee.list(),
    ]);
    setExistingDepartments(depts);
    setExistingLocations(locs);
    
    // Detect duplicates
    const rowsWithDuplicates = await detectDuplicates(mapped, existingEmps);
    setMappedRows(rowsWithDuplicates);
    
    // Find new departments
    const existingDeptNames = new Set(depts.map(d => d.name.toLowerCase()));
    const uniqueDeptNames = [...new Set(mapped.map(r => r.department_name).filter(Boolean))];
    const newDepts = uniqueDeptNames.filter(name => !existingDeptNames.has(name.toLowerCase()));
    setNewDepartments(newDepts);
    
    setStep('preview');
  };

  const toggleRowImport = (index) => {
    setMappedRows(prev => prev.map((row, i) => 
      i === index ? { ...row, importSelected: !row.importSelected } : row
    ));
  };

  const handleImport = async () => {
    setStep('importing');
    
    const results = {
      successes: 0,
      failures: [],
      departmentsCreated: 0,
      skippedDuplicates: [],
    };

    try {
      // Create new departments
      const deptMap = {};
      existingDepartments.forEach(d => {
        deptMap[d.name.toLowerCase()] = d.id;
      });

      for (const deptName of newDepartments) {
        const newDept = await Department.create({ name: deptName });
        deptMap[deptName.toLowerCase()] = newDept.id;
        results.departmentsCreated++;
      }

      // Build location map
      const locMap = {};
      existingLocations.forEach(l => {
        locMap[l.name.toLowerCase()] = l.id;
      });

      // Import employees
      for (let i = 0; i < mappedRows.length; i++) {
        const row = mappedRows[i];
        const rowNum = i + 2; // Account for header row and 0-index

        // Skip file duplicates
        if (row.fileDuplicate) {
          results.skippedDuplicates.push({
            row: rowNum,
            name: `${row.first_name} ${row.last_name}`,
            email: row.email,
            reason: 'Duplicate email within file',
          });
          continue;
        }

        // Skip if not selected for import
        if (!row.importSelected) {
          if (row.duplicateScenario === 'hard_match_active') {
            const match = row.matchingEmployees[0];
            results.skippedDuplicates.push({
              row: rowNum,
              name: `${row.first_name} ${row.last_name}`,
              email: row.email,
              reason: `Matched existing active employee: ${match.first_name} ${match.last_name} (${match.email})`,
            });
          } else {
            results.skippedDuplicates.push({
              row: rowNum,
              name: `${row.first_name} ${row.last_name}`,
              email: row.email,
              reason: 'Manually skipped',
            });
          }
          continue;
        }
        
        const errors = validateRow(row);
        if (errors.length > 0) {
          results.failures.push({ row: rowNum, errors });
          continue;
        }

        const deptId = deptMap[row.department_name.toLowerCase()];
        if (!deptId) {
          results.failures.push({ row: rowNum, errors: [`Department "${row.department_name}" not found`] });
          continue;
        }

        const employeeData = {
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          job_title: row.job_title,
          department_id: deptId,
          employment_type: row.employment_type || 'full_time',
          status: row.status || 'active',
          start_date: row.start_date,
        };

        if (row.preferred_name) employeeData.preferred_name = row.preferred_name;
        if (row.personal_email) employeeData.personal_email = row.personal_email;
        if (row.phone) employeeData.phone = row.phone;
        if (row.end_date) employeeData.end_date = row.end_date;
        
        if (row.location_name) {
          const locId = locMap[row.location_name.toLowerCase()];
          if (locId) employeeData.location_id = locId;
        }

        try {
          await Employee.create(employeeData);
          results.successes++;
        } catch (err) {
          results.failures.push({ row: rowNum, errors: [err.message || 'Failed to create employee'] });
        }
      }

      setImportResults(results);
      setStep('complete');
    } catch (err) {
      setError(err.message || 'Import failed');
      setStep('preview');
    }
  };

  const handleClose = () => {
    if (step === 'complete' && onComplete) {
      onComplete();
    }
    onClose();
  };

  // Calculate import counts for preview
  const importableCount = mappedRows.filter(r => r.importSelected && !r.fileDuplicate).length;
  const duplicateCount = mappedRows.filter(r => r.fileDuplicate || r.matchingEmployees.length > 0).length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Bulk Import Employees</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          )}

          {step === 'upload' && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                Drag and drop your CSV file here
              </p>
              <p className="text-sm text-gray-500 mb-4">or</p>
              <label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button type="button" variant="outline" asChild>
                  <span className="cursor-pointer">Browse Files</span>
                </Button>
              </label>
              <p className="text-xs text-gray-400 mt-4">
                Expected columns: firstName, lastName, email, jobTitle, departmentName, employmentType, status, startDate
              </p>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-green-600" />
                  <span className="font-medium">{file?.name}</span>
                  <Badge>{mappedRows.length} rows</Badge>
                </div>
                {duplicateCount > 0 && (
                  <div className="flex items-center gap-2 text-sm text-yellow-700">
                    <AlertTriangle className="h-4 w-4" />
                    {duplicateCount} potential duplicate(s) detected
                  </div>
                )}
              </div>

              {newDepartments.length > 0 && (
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-yellow-800 mb-2">
                      New departments will be created:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {newDepartments.map(name => (
                        <Badge key={name} variant="warning">{name}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700 w-10">Import</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Email</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Job Title</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Department</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {mappedRows.slice(0, 50).map((row, idx) => {
                      const errors = validateRow(row);
                      const isNewDept = newDepartments.includes(row.department_name);
                      const statusDisplay = getRowStatusDisplay(row);
                      const StatusIcon = statusDisplay.icon;
                      
                      const rowBgClass = row.fileDuplicate 
                        ? 'bg-gray-50' 
                        : row.duplicateScenario === 'hard_match_active'
                          ? 'bg-red-50'
                          : row.duplicateScenario === 'hard_match_terminated'
                            ? 'bg-yellow-50'
                            : errors.length > 0 
                              ? 'bg-red-50' 
                              : '';

                      return (
                        <tr key={idx} className={rowBgClass}>
                          <td className="px-3 py-2">
                            <Checkbox
                              checked={row.importSelected}
                              onCheckedChange={() => toggleRowImport(idx)}
                              disabled={row.fileDuplicate}
                            />
                          </td>
                          <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <div>
                              {row.first_name} {row.last_name}
                              {errors.length > 0 && (
                                <p className="text-red-500 text-xs mt-0.5">
                                  {errors.join(', ')}
                                </p>
                              )}
                              {row.matchingEmployees.length > 0 && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  Matches: {row.matchingEmployees.map(m => m.email).join(', ')}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">{row.email}</td>
                          <td className="px-3 py-2">{row.job_title}</td>
                          <td className="px-3 py-2">
                            {row.department_name}
                            {isNewDept && <Badge variant="warning" className="ml-2 text-xs">New</Badge>}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <StatusIcon className="h-3.5 w-3.5" />
                              <Badge variant={statusDisplay.variant}>{statusDisplay.label}</Badge>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {mappedRows.length > 50 && (
                  <div className="px-3 py-2 text-sm text-gray-500 bg-gray-50 border-t">
                    Showing 50 of {mappedRows.length} rows
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 mx-auto text-blue-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-gray-900">Importing employees...</p>
              <p className="text-sm text-gray-500">Please wait while we process your file</p>
            </div>
          )}

          {step === 'complete' && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Import Complete</h3>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-gray-900">{mappedRows.length}</p>
                    <p className="text-sm text-gray-500">Total Rows</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">{importResults.successes}</p>
                    <p className="text-sm text-gray-500">Created</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-yellow-600">{importResults.skippedDuplicates.length}</p>
                    <p className="text-sm text-gray-500">Skipped (Duplicates)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-red-600">{importResults.failures.length}</p>
                    <p className="text-sm text-gray-500">Failed</p>
                  </CardContent>
                </Card>
              </div>

              {importResults.skippedDuplicates.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Skipped Duplicates</h4>
                    <div className="max-h-48 overflow-auto space-y-2">
                      {importResults.skippedDuplicates.map((skip, idx) => (
                        <div key={idx} className="text-sm flex items-start gap-2">
                          <span className="font-medium text-gray-600 shrink-0">Row {skip.row}:</span>
                          <span className="text-gray-700">{skip.name} ({skip.email})</span>
                          <span className="text-gray-400">—</span>
                          <span className="text-yellow-600">{skip.reason}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {importResults.failures.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Failed Rows</h4>
                    <div className="max-h-48 overflow-auto space-y-2">
                      {importResults.failures.map((failure, idx) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium text-gray-700">Row {failure.row}:</span>{' '}
                          <span className="text-red-600">{failure.errors.join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {importResults.departmentsCreated > 0 && (
                <p className="text-sm text-gray-500 text-center">
                  {importResults.departmentsCreated} new department(s) were created during import.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {step === 'preview' && (
              <span>{importableCount} of {mappedRows.length} rows will be imported</span>
            )}
          </div>
          <div className="flex gap-3">
            {step === 'upload' && (
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
            )}
            {step === 'preview' && (
              <>
                <Button variant="outline" onClick={() => { setStep('upload'); setFile(null); }}>
                  Back
                </Button>
                <Button onClick={handleImport} disabled={importableCount === 0}>
                  Import {importableCount} Employee{importableCount !== 1 ? 's' : ''}
                </Button>
              </>
            )}
            {step === 'complete' && (
              <Button onClick={handleClose}>Done</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}