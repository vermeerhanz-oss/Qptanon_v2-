/**
 * Simple Chat Interpreter
 * 
 * Parses natural language messages and maps them to structured commands.
 * This is a local pattern-matching interpreter (no external LLM).
 */

import { executeCommand } from './commandExecutor';

/**
 * Interpret a natural language message and execute the appropriate command
 * @param {string} messageText - User's natural language input
 * @param {Object} context - Employee context with permissions
 * @returns {Promise<{ ok: boolean, message: string, data?: any }>}
 */
export async function interpretAndExecute(messageText, context = null) {
  const text = messageText.toLowerCase().trim();

  // Try each interpreter in order
  const interpreters = [
    interpretCreateEntity,
    interpretAddEmployee,
    interpretChangeReportingLine,
  ];

  for (const interpret of interpreters) {
    const command = interpret(text, messageText);
    if (command) {
      // Pass context for permission checks
      const result = await executeCommand(command, context);
      return {
        ok: result.success,
        message: result.message || result.error,
        data: result.data,
      };
    }
  }

  // No pattern matched
  return {
    ok: false,
    message: "I didn't understand that. Try:\n• \"Create an entity called [Name] in [Country]\"\n• \"Add employee [First] [Last] as [Role] in [Department]\"\n• \"Change [email] to report to [manager email]\"",
  };
}

/**
 * Interpret "create entity" commands
 * Patterns:
 * - "create an entity called Acme UK in United Kingdom"
 * - "create entity Acme Australia in Australia"
 * - "add a new entity called Test Corp in USA"
 */
function interpretCreateEntity(text, original) {
  // Pattern: create/add entity [called] <name> in <country>
  const patterns = [
    /(?:create|add)\s+(?:a\s+)?(?:new\s+)?entity\s+(?:called\s+)?["']?([^"']+?)["']?\s+in\s+(.+)/i,
    /(?:create|add)\s+(?:a\s+)?(?:new\s+)?(?:uk|us|au|australian|american|british)\s+entity\s+(?:called\s+)?["']?([^"']+?)["']?/i,
  ];

  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (match) {
      const name = match[1].trim();
      let country = match[2]?.trim() || inferCountry(original);
      
      if (!country) {
        country = 'Australia'; // Default
      }

      return {
        type: 'create_entity',
        payload: { name, country },
      };
    }
  }

  // Simpler pattern: "create entity Acme UK"
  const simpleMatch = original.match(/(?:create|add)\s+(?:a\s+)?(?:new\s+)?entity\s+(?:called\s+)?["']?([^"']+?)["']?$/i);
  if (simpleMatch) {
    const name = simpleMatch[1].trim();
    const country = inferCountry(name) || 'Australia';
    return {
      type: 'create_entity',
      payload: { name, country },
    };
  }

  return null;
}

/**
 * Interpret "add employee" commands
 * Patterns:
 * - "add employee John Smith as Software Engineer in Engineering"
 * - "add John Smith to Sales as Account Manager"
 * - "hire Jane Doe as Designer in Product"
 */
function interpretAddEmployee(text, original) {
  // Pattern: add/hire employee <name> as <role> in <department>
  const patterns = [
    /(?:add|hire|create)\s+(?:an?\s+)?(?:new\s+)?(?:employee\s+)?([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+(?:as|to\s+be)\s+(?:a\s+)?(.+?)\s+in\s+(.+)/i,
    /(?:add|hire)\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+to\s+(.+?)\s+as\s+(?:a\s+)?(.+)/i,
    /(?:add|hire|create)\s+(?:an?\s+)?(?:new\s+)?(?:employee\s+)?([A-Z][a-z]+)\s+([A-Z][a-z]+)\s+(?:as|to\s+be)\s+(?:a\s+)?(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = original.match(pattern);
    if (match) {
      let firstName, lastName, roleTitle, department;

      if (pattern === patterns[1]) {
        // Pattern: add <name> to <department> as <role>
        [, firstName, lastName, department, roleTitle] = match;
      } else if (pattern === patterns[2]) {
        // Pattern without department
        [, firstName, lastName, roleTitle] = match;
        department = inferDepartment(roleTitle);
      } else {
        [, firstName, lastName, roleTitle, department] = match;
      }

      // Generate a work email
      const workEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`;

      return {
        type: 'add_employee',
        payload: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          work_email: workEmail,
          role_title: roleTitle.trim(),
          department: department?.trim() || 'General',
        },
      };
    }
  }

  return null;
}

/**
 * Interpret "change reporting line" commands
 * Patterns:
 * - "change sarah@company.com to report to alice@company.com"
 * - "move john@acme.com under jane@acme.com"
 * - "Sarah should report to Alice"
 */
function interpretChangeReportingLine(text, original) {
  // Pattern with emails
  const emailPatterns = [
    /(?:change|move|make)\s+(\S+@\S+)\s+(?:to\s+)?report\s+to\s+(\S+@\S+)/i,
    /(?:change|move|make)\s+(\S+@\S+)\s+(?:under|to)\s+(\S+@\S+)/i,
    /(\S+@\S+)\s+(?:should|will|now)\s+report(?:s)?\s+to\s+(\S+@\S+)/i,
  ];

  for (const pattern of emailPatterns) {
    const match = original.match(pattern);
    if (match) {
      return {
        type: 'change_reporting_line',
        payload: {
          employee_email: match[1].toLowerCase().trim(),
          new_manager_email: match[2].toLowerCase().trim(),
        },
      };
    }
  }

  // Pattern with names (will need to look up emails)
  const namePatterns = [
    /(?:change|move|make)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:to\s+)?report\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:should|will|now)\s+report(?:s)?\s+to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  ];

  for (const pattern of namePatterns) {
    const match = original.match(pattern);
    if (match) {
      // Convert names to emails (simple assumption)
      const employeeName = match[1].trim().toLowerCase().replace(/\s+/g, '.');
      const managerName = match[2].trim().toLowerCase().replace(/\s+/g, '.');
      
      return {
        type: 'change_reporting_line',
        payload: {
          employee_email: `${employeeName}@company.com`,
          new_manager_email: `${managerName}@company.com`,
        },
      };
    }
  }

  return null;
}

/**
 * Infer country from text
 */
function inferCountry(text) {
  const countryMap = {
    'uk': 'United Kingdom',
    'united kingdom': 'United Kingdom',
    'britain': 'United Kingdom',
    'british': 'United Kingdom',
    'england': 'United Kingdom',
    'us': 'United States',
    'usa': 'United States',
    'united states': 'United States',
    'america': 'United States',
    'american': 'United States',
    'au': 'Australia',
    'australia': 'Australia',
    'australian': 'Australia',
    'nz': 'New Zealand',
    'new zealand': 'New Zealand',
    'canada': 'Canada',
    'canadian': 'Canada',
    'germany': 'Germany',
    'german': 'Germany',
    'france': 'France',
    'french': 'France',
    'singapore': 'Singapore',
    'india': 'India',
    'indian': 'India',
  };

  const lower = text.toLowerCase();
  for (const [key, value] of Object.entries(countryMap)) {
    if (lower.includes(key)) {
      return value;
    }
  }
  return null;
}

/**
 * Infer department from role title
 */
function inferDepartment(roleTitle) {
  const lower = roleTitle.toLowerCase();
  
  const deptMap = {
    'engineer': 'Engineering',
    'developer': 'Engineering',
    'programmer': 'Engineering',
    'software': 'Engineering',
    'devops': 'Engineering',
    'qa': 'Engineering',
    'test': 'Engineering',
    'designer': 'Product',
    'product': 'Product',
    'ux': 'Product',
    'ui': 'Product',
    'sales': 'Sales',
    'account': 'Sales',
    'business development': 'Sales',
    'marketing': 'Marketing',
    'content': 'Marketing',
    'seo': 'Marketing',
    'hr': 'Human Resources',
    'people': 'Human Resources',
    'recruiter': 'Human Resources',
    'finance': 'Finance',
    'accountant': 'Finance',
    'payroll': 'Finance',
    'legal': 'Legal',
    'counsel': 'Legal',
    'compliance': 'Legal',
    'operations': 'Operations',
    'admin': 'Operations',
    'support': 'Customer Support',
    'customer': 'Customer Support',
    'ceo': 'Executive',
    'cto': 'Executive',
    'cfo': 'Executive',
    'coo': 'Executive',
    'chief': 'Executive',
    'vp': 'Executive',
    'director': 'Executive',
  };

  for (const [key, value] of Object.entries(deptMap)) {
    if (lower.includes(key)) {
      return value;
    }
  }
  
  return 'General';
}