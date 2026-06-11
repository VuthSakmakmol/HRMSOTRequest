// frontend/src/shared/i18n/messages/en.js

export default {
  common: {
    appName: 'OT Request',

    loading: 'Loading',

    updating: 'Updating',
    search: 'Search',
    refresh: 'Refresh',
    clear: 'Clear',
    selectAll: 'Select all',
    export: 'Export',
    import: 'Import',
    download: 'Download',
    create: 'Create',
    update: 'Update',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    approve: 'Approve',
    reject: 'Reject',
    view: 'View',
    detail: 'Detail',
    action: 'Action',
    actions: 'Actions',
    edit: 'Edit',
    back: 'Back',

    no: 'No.',
    yes: 'Yes',
    none: 'None',
    unknown: 'Unknown',
    warning: 'Warning',
    thisData: 'This data',

    status: 'Status',
    statuss: 'Status',
    allStatus: 'All Status',
    active: 'Active',
    inactive: 'Inactive',

    fromDate: 'From Date',
    toDate: 'To Date',
    date: 'Date',
    name: 'Name',
    code: 'Code',
    description: 'Description',
    createdAt: 'Created At',
    updatedAt: 'Updated At',

    loaded: 'Loaded {loaded} of {total}',
    noData: 'No data found',
    somethingWentWrong: 'Something went wrong',
    loadFailed: 'Load failed',
    createFailed: 'Create failed',
    updateFailed: 'Update failed',
    saveFailed: 'Save failed',
    downloadFailed: 'Download failed',
    created: 'Created',
    updated: 'Updated',
    deleted: 'Deleted',
    deleteFailed: 'Delete failed',
    downloaded: 'Downloaded',
    loadingData: 'Loading data',
    fetchingRecords: 'Fetching records from the server.',

    noPermission: 'No permission',
    openNavigation: 'Open navigation',
    toggleDesktopSidebar: 'Toggle desktop sidebar',
    toggleTheme: 'Toggle theme',
    switchToLightMode: 'Switch to Light Mode',
    switchToDarkMode: 'Switch to Dark Mode',
    notifications: 'Notifications',
    language: 'Language',

    status: {
      active: 'Active',
      inactive: 'Inactive',
      unknown: 'Unknown',
    },

    error: {
      internalServerError: 'Internal server error.',
      validationError: 'Validation error.',
      invalidId: 'Invalid ID.',
      notFound: 'Not found.',
      routeNotFound: 'Route not found.',
      duplicateRecord: 'Duplicate record.',
      checkRequiredFields: 'Please check the required fields.',
      duplicateOrConflict:
        'This record already exists or conflicts with another record.',
      missingPermissionWithSubject:
        '{subject} cannot be loaded because your account is missing permission: {permission}.',
      missingPermissionForSubject:
        '{subject} cannot be loaded because your account does not have the required permission.',
      saveMissingPermission:
        'You cannot save this record because your account is missing permission: {permission}.',
      saveNoPermission: 'You do not have permission to save this record.',
    },

    validation: {
      invalidId: 'Invalid ID.',
      idRequired: 'ID is required.',
      tooLong: 'Value is too long.',
      dateInvalid: 'Date is invalid.',
      timeRequired: 'Time is required.',
      timeInvalid: 'Time must use HH:mm format.',
      pageInvalid: 'Page is invalid.',
      limitInvalid: 'Limit is invalid.',
      searchTooLong: 'Search text is too long.',
      sortFieldInvalid: 'Sort field is invalid.',
    },
  },

  validation: {
    field: {
      invalid: 'Invalid value.',
    },
    id: {
      invalid: 'Invalid ID.',
    },
    page: {
      invalid: 'Invalid page.',
    },
    limit: {
      invalid: 'Invalid limit.',
    },
    search: {
      invalid: 'Invalid search value.',
    },
    isActive: {
      invalid: 'Invalid status.',
    },
    sortField: {
      invalid: 'Invalid sort field.',
    },
    sortOrder: {
      invalid: 'Invalid sort order.',
    },
  },

  auth: {
    login: 'Login',
    logout: 'Logout',
    username: 'Username',
    loginId: 'Login ID',
    password: 'Password',
    profile: 'Profile',

    accessDenied: 'Access denied',
    noPermission: 'You do not have permission to access this page.',

    loginSubtitle: 'Sign in with your company account to continue.',
    loginIdPlaceholder: 'Enter login ID',
    passwordPlaceholder: 'Enter password',
    signingIn: 'Signing in...',

    validation: {
      loginIdRequired: 'Login ID is required.',
      passwordRequired: 'Password is required.',
    },

    error: {
      loginFailed: 'Login failed. Please try again.',
      invalidCredentials: 'Invalid login credentials.',
      unauthorized: 'Unauthorized. Please login again.',
      sessionExpired: 'Session expired. Please login again.',
      invalidToken: 'Invalid or expired token.',
      employeeLinkRequired:
        'Your login account is not linked to an employee profile.',
    },

    account: {
      tableTitle: 'Account List',
      tableSubtitle: 'Server-side account list with lazy loading.',

      newAccount: 'New Account',
      createTitle: 'Create Account',
      editTitle: 'Edit Account',

      searchPlaceholder:
        'Search login ID, display name, employee, role, or permission',

      noData: 'No accounts matched your filters.',
      loadFailed: 'Failed to load accounts.',

      displayName: 'Display Name',
      directPermissions: 'Direct Permissions',
      mustChangePassword: 'Must Change Password',

      selectEmployee: 'Select employee',
      selectRoles: 'Select roles',

      directPermissionHelp: 'Separate permission codes with commas.',
      directPermissionPlaceholder: 'ACCOUNT_VIEW, ACCOUNT_CREATE',

      loginIdExample: 'Example: john.smith',
      displayNameExample: 'Example: John Smith',

      unnamedEmployee: 'Unnamed Employee',
      unnamedRole: 'Unnamed Role',

      employeeOptionsLoadFailed: 'Employee options could not be loaded.',
      roleOptionsLoadFailed: 'Role options could not be loaded.',

      createdSuccess: 'Account created successfully.',
      updatedSuccess: 'Account updated successfully.',
      createFailed: 'Failed to create account.',
      updateFailed: 'Failed to update account.',

      reset: 'Reset',
      resetPassword: 'Reset Password',
      newPassword: 'New Password',
      forcePasswordChange: 'Force password change after reset',
      resettingFor: 'Resetting password for',
      passwordReset: 'Password reset',
      passwordResetSuccess: 'Password reset successfully.',
      resetFailed: 'Password reset failed.',

      validation: {
        loginIdRequired: 'Login ID is required.',
        loginIdTooLong: 'Login ID must not be longer than 100 characters.',
        displayNameRequired: 'Display Name is required.',
        passwordMinLength: 'Password must be at least 6 characters.',
        passwordMaxLength: 'Password must not be longer than 100 characters.',
      },

      error: {
        notFound: 'Account not found.',
        loginIdExists: 'Login ID already exists.',
      },

      success: {
        passwordReset: 'Password reset successfully.',
      },
    },
  },
  profile: {
    unknownUser: 'User',
    accountInformation: 'Account Information',
    displayName: 'Display Name',
    loginId: 'Login ID',
    employee: 'Employee',
    department: 'Department',
    position: 'Position',
  },

  nav: {
    workspace: 'Workspace',
    dashboard: 'Dashboard',

    organization: 'Organization',
    permissions: 'Permissions',
    roles: 'Roles',
    departments: 'Departments',
    positions: 'Positions',
    lines: 'Lines',
    employees: 'Employees',
    orgChart: 'Overtime Flow',

    calendar: 'Calendar',
    holidayMaster: 'Holiday Master',

    shift: 'Shift',
    shiftMaster: 'Shift Master',
    paymentAllowancePolicies: 'Allowance Policies',

    accessControl: 'Access Control',
    accounts: 'Accounts',

    attendance: 'Attendance',
    attendanceImport: 'Attendance Import',
    attendanceRecords: 'Attendance Records',
    otVerification: 'OT Verification',

    overtime: 'Overtime',
    otRequests: 'OT Requests',
    approvalInbox: 'Approval Inbox',
    acknowledgeInbox: 'Acknowledge Inbox',
    otPolicies: 'OT Policies',
    shiftOtOptions: 'Shift OT Options',

    payment: 'Payment',
    paymentProcess: 'Payment Process',
    paymentFormulas: 'Payment Formulas',
    paymentExchangeRates: 'Exchange Rates',
  },
  

  access: {
    error: {
      missingPermission: 'You do not have the required permission.',
      permissionMiddlewareConfigError:
        'Permission middleware is missing the required permission code.',
    },

    permission: {
      tableTitle: 'Permission List',
      searchPlaceholder: 'Search permission code, name, module, or description',
      module: 'Module',
      allModules: 'All Modules',

      loading: 'Loading permissions...',
      noData: 'No permissions matched your filters.',
      loadFailed: 'Failed to load permissions.',

      error: {
        notFound: 'Permission not found.',
      },
    },

    role: {
      tableTitle: 'Role List',
      searchPlaceholder: 'Search role code or display name',

      newRole: 'New Role',
      expandAll: 'Expand All',
      collapseAll: 'Collapse All',

      createTitle: 'Create Role',
      editTitle: 'Edit Role',
      roleCode: 'Role Code',
      roleCodeExample: 'Example: SYSTEM_ADMIN',
      displayName: 'Display Name',
      displayNameExample: 'Example: System Admin',

      permissionsByModule: 'Permissions by Module',
      count: 'Count',
      selectedCount: '{count} selected',
      moduleSelectedCount: '{selected} of {total} selected',
      morePermissions: '+{count} more',

      noData: 'No roles matched your filters.',
      loadFailed: 'Failed to load roles.',
      saveFailed: 'Failed to save role.',
      createdSuccess: 'Role created successfully.',
      updatedSuccess: 'Role updated successfully.',

      validation: {
        codeRequired: 'Role code is required.',
        codeTooLong: 'Role code is too long.',
        displayNameRequired: 'Display name is required.',
        displayNameTooLong: 'Display name is too long.',
        updatePayloadRequired: 'Please update at least one field.',
      },

      error: {
        notFound: 'System role not found.',
        codeExists: 'Role code already exists.',
        invalidPermissionIds: 'Some permission IDs are invalid.',
        permissionInactiveOrNotFound:
          'Some permissions are invalid or inactive.',
      },
    },
  },

  org: {
    error: {
      chartCycle: 'Organization chart contains a cycle.',
      approverNotFound: 'Organization chart is broken: approver not found.',
      chartTooDeep: 'Organization chart is too deep or cyclic.',
    },

    department: {
      tableTitle: 'Department List',
      searchPlaceholder: 'Search code or name',

      newDepartment: 'New Department',
      importExcel: 'Import Excel',
      exportExcel: 'Export Excel',

      createTitle: 'Create Department',
      editTitle: 'Edit Department',
      departmentCode: 'Department Code',
      departmentName: 'Department Name',
      codeExample: 'Example: HR',
      nameExample: 'Example: Human Resources',

      exported: 'Exported',
      exportedSuccess: 'Department Excel exported successfully.',
      exportFailed: 'Export failed',

      imported: 'Imported',
      importedSuccess:
        'Import completed. Created: {created}, Updated: {updated}.',

      importTitle: 'Import Department Excel',
      importGuideTitle: 'Import guide',
      importGuideStep1: 'Download the sample file.',
      importGuideStep2: 'Fill your department data in the same format.',
      importGuideStep3: 'Choose the completed Excel file from your computer.',
      importGuideStep4: 'Click Import to upload and process it.',
      importAllOrNothingNote:
        'All rows must be 100% valid. If any row has an error, nothing will be saved.',

      downloadSample: 'Download Sample',
      downloadSampleFailed: 'Download sample failed',
      sampleDownloaded: 'Sample file downloaded successfully.',

      excelFile: 'Excel file',
      chooseFile: 'Choose File',
      noFileSelected: 'No file selected',

      importInvalidFileTitle: 'Invalid file type',
      importInvalidFileMessage:
        'Please choose an Excel file only: .xlsx, .xls, or .csv.',
      importFailed: 'Import failed',

      importValidationFailed: 'Import validation failed',
      importErrorCount: '{count} error(s) found',
      importErrorListTitle: 'Fix these Excel rows before importing',
      importRow: 'Row',
      importField: 'Field',
      importValue: 'Value',
      importReason: 'Reason',
      importUnknownError: 'Unknown import error',

      noData: 'No departments matched your filters.',
      loadFailed: 'Failed to load departments.',
      saveFailed: 'Failed to save department.',
      createdSuccess: 'Department created successfully.',
      updatedSuccess: 'Department updated successfully.',

      validation: {
        codeMinLength: 'Department code must be at least 2 characters.',
        codeTooLong: 'Department code must not be longer than 30 characters.',
        nameMinLength: 'Department name must be at least 2 characters.',
        nameTooLong: 'Department name must not be longer than 120 characters.',
        updatePayloadRequired: 'Please update at least one field.',
      },

      error: {
        notFound: 'Department not found.',
        codeExists: 'Department code already exists.',
        invalidId: 'Invalid department ID.',
        excelFileRequired: 'Excel file is required.',
        excelNoRows: 'Excel file has no rows.',
      },

      import: {
        success: {
          completed: 'Department import completed successfully.',
        },

        error: {
          validationFailed:
            'Import failed. Please fix all row errors and try again.',
          noValidRows: 'Excel file has no valid department rows.',
          duplicateDatabaseCode:
            'Import failed because one or more department codes conflict with existing data.',

          codeRequired: 'Code is required.',
          codeMinLength: 'Code must be at least {min} characters.',
          codeTooLong: 'Code must not be longer than {max} characters.',

          nameRequired: 'Name is required.',
          nameMinLength: 'Name must be at least {min} characters.',
          nameTooLong: 'Name must not be longer than {max} characters.',

          invalidStatus: 'Status must be Active or Inactive.',
          duplicateCode:
            'Duplicate code "{code}" in Excel file. First found at row {firstRowNo}.',
        },
      },
    },

    position: {
      tableTitle: 'Position List',
      searchPlaceholder:
        'Search code, name, department, reports-to position, or description',

      department: 'Department',
      allDepartments: 'All Departments',

      hierarchyScope: 'Hierarchy Scope',
      allScopes: 'All Scopes',
      selectHierarchyScope: 'Select hierarchy scope',
      scopeSameLine: 'Same Line',
      scopeGlobal: 'Global',
      scopeCrossDepartment: 'Cross Department',

      newPosition: 'New Position',
      importExcel: 'Import Excel',
      exportExcel: 'Export Excel',

      createTitle: 'Create Position',
      editTitle: 'Edit Position',
      positionCode: 'Position Code',
      positionName: 'Position Name',
      codeExample: 'Example: SEWER',
      nameExample: 'Example: Sewer',
      selectDepartment: 'Select department',

      reportsToPosition: 'Reports To Position',
      selectReportsToPosition: 'Optional: select parent/supervisor position',
      reportsToHelp:
        'Example: Sewer reports to Sewing Supervisor. Cross-department reporting is allowed.',

      managerScope: 'Manager Scope',
      sameLine: 'Same Line',
      global: 'Global',
      managerScopeHelp:
        'Same Line = find manager in the same production line. Global = find manager by parent position across departments.',

      level: 'Level',
      activeHelp:
        'Inactive positions will be hidden from normal employee assignment selectors.',
      descriptionPlaceholder: 'Optional position description',

      exported: 'Exported',
      exportedSuccess: 'Position Excel exported successfully.',
      exportFailed: 'Export failed',

      imported: 'Imported',
      importedSuccess:
        'Import completed. Created: {created}, Updated: {updated}.',

      importTitle: 'Import Position Excel',
      importGuideTitle: 'Import guide',
      importGuideStep1: 'Download the sample file.',
      importGuideStep2: 'Fill your position data using readable codes only.',
      importGuideStep3:
        'Department Code must already exist in Department master data.',
      importGuideStep4:
        'Reports To Position Code must already exist or be included in the same import file.',
      importGuideStep5: 'Click Import to upload and process it.',
      importNote:
        'Users never need Mongo IDs in Excel. Use readable codes such as Department Code and Position Code.',
      importAllOrNothingNote:
        'All rows must be 100% valid. If any row has an error, nothing will be saved.',
      importUploading: 'Uploading file... {percent}%',
      importProcessing: 'File uploaded. Validating Excel rows and saving data...',

      downloadSample: 'Download Sample',
      downloadSampleFailed: 'Download sample failed',
      sampleDownloaded: 'Sample file downloaded successfully.',

      excelFile: 'Excel file',
      chooseFile: 'Choose File',
      noFileSelected: 'No file selected',

      importInvalidFileTitle: 'Invalid file type',
      importInvalidFileMessage:
        'Please choose an Excel file only: .xlsx, .xls, or .csv.',
      importFailed: 'Import failed',

      importValidationFailed: 'Import validation failed',
      importErrorCount: '{count} error(s) found',
      importErrorListTitle: 'Fix these Excel rows before importing',
      importRow: 'Row',
      importField: 'Field',
      importValue: 'Value',
      importReason: 'Reason',
      importUnknownError: 'Unknown import error',

      noData: 'No positions matched your filters.',
      loadFailed: 'Failed to load positions.',
      departmentLoadFailed: 'Failed to load departments.',
      departmentLookupFailed: 'Failed to load department options.',
      parentLoadFailed: 'Failed to load reports-to positions.',
      reportsToLookupFailed: 'Failed to load reports-to position options.',
      saveFailed: 'Failed to save position.',
      createdSuccess: 'Position created successfully.',
      updatedSuccess: 'Position updated successfully.',

      validation: {
        codeMinLength: 'Position code must be at least 2 characters.',
        codeTooLong: 'Position code must not be longer than 50 characters.',
        nameMinLength: 'Position name must be at least 2 characters.',
        nameTooLong: 'Position name must not be longer than 150 characters.',
        descriptionTooLong:
          'Description must not be longer than 1000 characters.',
        updatePayloadRequired: 'Please update at least one field.',
      },

      error: {
        invalidId: 'Invalid position ID.',
        notFound: 'Position not found.',
        codeExists: 'Position code already exists.',
        departmentNotFound: 'Department not found.',
        reportsToNotFound: 'Reports-to position not found.',
        cannotReportToSelf: 'Position cannot report to itself.',
        excelFileRequired: 'Excel file is required.',
        excelNoRows: 'Excel file has no rows.',
        excelNoValidRows: 'Excel file has no valid rows.',
      },

      import: {
        success: {
          completed: 'Position import completed successfully.',
        },

        error: {
          validationFailed:
            'Import failed. Please fix all row errors and try again.',
          duplicateDatabaseCode:
            'Import failed because one or more position codes conflict with existing data.',

          codeRequired: 'Code is required.',
          codeMinLength: 'Code must be at least {min} characters.',
          codeTooLong: 'Code must not be longer than {max} characters.',

          nameRequired: 'Name is required.',
          nameMinLength: 'Name must be at least {min} characters.',
          nameTooLong: 'Name must not be longer than {max} characters.',

          departmentCodeTooLong:
            'Department Code must not be longer than {max} characters.',
          departmentNotFound:
            'Department Code "{departmentCode}" was not found.',

          reportsToCodeTooLong:
            'Reports To Position Code must not be longer than {max} characters.',
          reportsToNotFound:
            'Reports To Position Code "{reportsToPositionCode}" was not found.',

          cannotReportToSelf: 'Position cannot report to itself.',
          invalidScope:
            'Hierarchy Scope must be SAME_LINE, GLOBAL, or CROSS_DEPARTMENT.',
          invalidLevel: 'Level must be a number greater than or equal to 0.',
          descriptionTooLong:
            'Description must not be longer than {max} characters.',
          invalidStatus: 'Status must be Active or Inactive.',
          duplicateCode:
            'Duplicate code "{code}" in Excel file. First found at row {firstRowNo}.',
        },
      },
    },

    employee: {
      tableTitle: 'Employee List',
      searchPlaceholder: 'Search employee code, name, phone, email, or OT role',

      allDepartments: 'All Departments',
      allPositions: 'All Positions',
      allLines: 'All Lines',
      allShifts: 'All Shifts',

      newEmployee: 'New Employee',
      importExcel: 'Import Excel',
      exportExcel: 'Export Excel',

      createTitle: 'Create Employee',
      editTitle: 'Edit Employee',

      employeeCode: 'Employee Code',
      displayName: 'Display Name',
      employeeCodeExample: 'Example: TRX001',
      displayNameExample: 'Example: John Smith',

      selectDepartment: 'Select department',
      selectPosition: 'Select position',
      selectLine: 'Select line',
      selectShift: 'Select shift',
      selectManager: 'Select manager/supervisor',

      manager: 'Manager',
      noManager: 'No Manager',

      otRole: 'OT Role',
      otWorkflowRole: {
        title: 'OT Workflow Role',
        none: 'None',
        approver: 'Approver',
        acknowledge: 'Acknowledge',
      },

      joinDate: 'Join Date',
      email: 'Email',
      phone: 'Phone',
      phonePlaceholder: 'Example: 012345678',

      hasAccount: 'Has Account',
      noAccount: 'No Account',
      accountAlreadyExists: 'This employee already has a login account.',
      createLoginAccount: 'Create Login Account',

      accountLoginId: 'Account Login ID',
      accountPassword: 'Account Password',
      mustChangePassword: 'Must Change Password',

      accountDefaultNoAccount: 'Default: no login account will be created.',
      accountPreview: 'Login ID: {loginId} · Default Password: {password}',

      accountLoginIdPlaceholder: 'Default: employee code',
      defaultPassword: 'Default Password',
      defaultPasswordPlaceholder: 'Default: employee code + phone number',

      accountPhoneRequired:
        'Phone number is required when creating a login account because the default password uses Employee Code + Phone Number.',

      accountActive: 'Account Active',

      createdWithAccountSuccess:
        'Employee and login account created successfully.',
      updatedWithAccountSuccess:
        'Employee updated and login account created successfully.',

      exported: 'Exported',
      exportedSuccess: 'Employee Excel exported successfully.',
      exportFailed: 'Export failed',

      imported: 'Imported',
      importedSuccess:
        'Import completed. Created: {created}, Updated: {updated}, Accounts created: {accountsCreated}.',

      importTitle: 'Import Employee Excel',
      importGuideTitle: 'Import guide',
      importGuideStep1: 'Download the sample file.',
      importGuideStep2: 'Fill your employee data using readable codes only.',
      importGuideStep3:
        'Join Date format must be DD/MM/YYYY, for example 30/04/2026.',
      importGuideStep4:
        'Department Code, Position Code, Line Code, and Shift Code must already exist in master data.',
      importGuideStep5:
        'Use Reports To Employee Code for manager/supervisor, then click Import.',
      importAllOrNothingNote:
        'All rows must be 100% valid. If any row has an error, nothing will be saved.',

      downloadSample: 'Download Sample',
      downloadSampleFailed: 'Download sample failed',
      sampleDownloaded: 'Sample file downloaded successfully.',

      excelFile: 'Excel file',
      chooseFile: 'Choose File',
      noFileSelected: 'No file selected',

      importInvalidFileTitle: 'Invalid file type',
      importInvalidFileMessage:
        'Please choose an Excel file only: .xlsx, .xls, or .csv.',
      importFailed: 'Import failed',

      importValidationFailed: 'Import validation failed',
      importErrorCount: '{count} error(s) found',
      importErrorListTitle: 'Fix these Excel rows before importing',
      importRow: 'Row',
      importField: 'Field',
      importValue: 'Value',
      importReason: 'Reason',
      importUnknownError: 'Unknown import error',
      importUploading: 'Uploading file... {percent}%',

      invalidExcelData: 'Invalid Excel data',
      importApiNotFound: 'Import API not found',
      duplicateData: 'Duplicate data',
      serverError: 'Server error',

      employeeCodeRequiredHelp:
        'Employee Code is required because the system uses it as the human-readable employee key.',
      joinDateFormatHelp:
        'Please use DD/MM/YYYY format, for example 30/04/2026.',
      checkDepartmentMaster: 'Please check Department master data.',
      checkPositionMaster: 'Please check Position master data.',
      positionDepartmentMismatchHelp:
        'The Position Code must belong to the selected Department Code.',
      checkLineMaster: 'Please check Line master data.',
      checkShiftMaster: 'Please check Shift master data.',
      checkManagerEmployeeCode:
        'Please import the manager first or use an existing manager Employee Code.',
      uniqueEmailHelp: 'Email must be unique or left blank.',

      selectLines: 'Select lines',
      lineHelp:
        'Select one or many lines. The first selected line becomes the primary line for old reports and compatibility.',
      multiLineHelp:
        'Select one or many lines. The first selected line becomes the primary line for old reports and compatibility.',

      noData: 'No employees matched your filters.',
      loadFailed: 'Failed to load employees.',
      departmentLoadFailed: 'Failed to load departments.',
      positionLoadFailed: 'Failed to load positions.',
      lineLoadFailed: 'Failed to load lines.',
      shiftLoadFailed: 'Failed to load shifts.',
      managerLoadFailed: 'Failed to load managers.',
      saveFailed: 'Failed to save employee.',
      createdSuccess: 'Employee created successfully.',
      updatedSuccess: 'Employee updated successfully.',

      field: {
        departmentId: {
          required: 'Department is required.',
          invalid: 'Department is invalid.',
        },
        positionId: {
          required: 'Position is required.',
          invalid: 'Position is invalid.',
        },
        lineId: {
          required: 'Line is required.',
          invalid: 'Line is invalid.',
        },
        lineIds: {
          required: 'Line is required.',
          invalid: 'One or more selected lines are invalid.',
        },
        shiftId: {
          required: 'Shift is required.',
          invalid: 'Shift is invalid.',
        },
        reportsToEmployeeId: {
          required: 'Manager is required.',
          invalid: 'Manager is invalid.',
        },
      },

      validation: {
        employeeCodeRequired: 'Employee Code is required.',
        employeeCodeTooLong:
          'Employee Code must not be longer than 50 characters.',
        displayNameRequired: 'Display Name is required.',
        displayNameTooLong:
          'Display Name must not be longer than 150 characters.',
        departmentCodeRequired: 'Department Code is required.',
        departmentCodeTooLong:
          'Department Code must not be longer than 50 characters.',
        positionCodeRequired: 'Position Code is required.',
        positionCodeTooLong:
          'Position Code must not be longer than 50 characters.',
        shiftCodeRequired: 'Shift Code is required.',
        shiftCodeTooLong: 'Shift Code must not be longer than 50 characters.',
        phoneTooLong: 'Phone must not be longer than 30 characters.',
        phoneRequiredForAccount:
          'Phone number is required when creating a login account for an employee.',
        joinDateInvalid: 'Join Date is invalid.',
        otWorkflowRoleInvalid:
          'OT Workflow Role must be NONE, APPROVER, or ACKNOWLEDGE.',
        isActiveInvalid: 'Status is invalid.',
        updatePayloadRequired: 'Please update at least one field.',
      },

      error: {
        notFound: 'Employee not found.',
        inactive: 'Employee is inactive.',
        notInScope: 'Employee is outside your scope.',
        outsideManagedScope:
          'Some selected employees are outside your managed scope.',
        employeeCodeExists: 'Employee Code already exists.',
        emailExists: 'Email already exists.',
        accountExists: 'This employee already has an account.',
        reportToSelf: 'Employee cannot report to self.',
        reportsToEmployeeNotFound: 'Reports-to employee not found.',
        excelFileRequired: 'Excel file is required.',
        excelWorksheetRequired: 'Excel file has no worksheet.',
        excelNoRows: 'Excel file has no data rows.',
        excelNoValidRows: 'Excel file has no valid rows.',
      },

      import: {
        success: {
          completed: 'Employee import completed successfully.',
        },

        error: {
          validationFailed:
            'Import failed. Please fix all row errors and try again.',
          duplicateDatabaseValue:
            'Import failed because one or more values already conflict with existing employee data.',

          employeeCodeRequired: 'Employee Code is required.',
          employeeCodeTooLong:
            'Employee Code must not be longer than 50 characters.',
          duplicateEmployeeCode:
            'Duplicate Employee Code "{employeeCode}" in Excel file. First found at row {firstRowNo}.',

          displayNameRequired: 'Display Name is required.',
          displayNameTooLong:
            'Display Name must not be longer than 150 characters.',

          departmentCodeRequired: 'Department Code is required.',
          departmentCodeTooLong:
            'Department Code must not be longer than 50 characters.',
          departmentNotFound:
            'Department Code "{departmentCode}" was not found.',

          positionCodeRequired: 'Position Code is required.',
          positionCodeTooLong:
            'Position Code must not be longer than 50 characters.',
          positionNotFound: 'Position Code "{positionCode}" was not found.',
          positionDepartmentMismatch:
            'Position Code "{positionCode}" does not belong to Department Code "{departmentCode}".',

          lineCodeTooLong: 'Line Code must not be longer than 50 characters.',
          lineNotFound: 'Line Code not found: {lineCodes}.',
          lineInactive: 'Inactive Line Code(s): {lineCodes}.',
          lineDepartmentMismatch:
            'These Line Code(s) do not support Department Code "{departmentCode}": {lineCodes}.',
          linePositionNotAllowed:
            'These Line Code(s) do not allow Position Code "{positionCode}": {lineCodes}.',

          shiftCodeRequired: 'Shift Code is required.',
          shiftCodeTooLong: 'Shift Code must not be longer than 50 characters.',
          shiftNotFound:
            'Shift Code "{shiftCode}" was not found or is inactive.',

          managerCodeTooLong:
            'Reports To Employee Code must not be longer than 50 characters.',
          managerNotFound:
            'Reports To Employee Code "{reportsToEmployeeCode}" was not found in Employee master or this import file.',
          reportToSelf: 'Employee cannot report to self.',

          invalidOTWorkflowRole:
            'OT Workflow Role must be NONE, APPROVER, or ACKNOWLEDGE.',
          phoneTooLong: 'Phone must not be longer than 30 characters.',
          emailTooLong: 'Email must not be longer than 150 characters.',
          emailInvalid: 'Email format is invalid.',
          duplicateEmail:
            'Duplicate Email "{email}" in Excel file. First found at row {firstRowNo}.',
          emailExists:
            'Email "{email}" already belongs to Employee Code "{ownerEmployeeCode}".',

          invalidJoinDate:
            'Join Date must use DD/MM/YYYY or YYYY-MM-DD format.',
          invalidStatus: 'Status must be Active or Inactive.',
          invalidCreateAccount: 'Create Account must be Yes or No. Blank = No.',

          phoneRequiredForAccount:
            'Phone is required because Create Account = Yes. Default password = Employee Code + Phone.',
          defaultPasswordInvalid:
            'Default password must be 6 to 100 characters. It is generated from Employee Code + Phone.',
          accountLoginIdExists: 'Account Login ID "{loginId}" already exists.',
        },
      },

      importProgress: {
        waitingUpload: 'Waiting for file upload...',
        readFile: 'Reading Excel file...',
        parseRows: 'Reading worksheet rows...',
        validateBasic: 'Checking required fields and duplicate rows...',
        matchDepartment: 'Matching department codes...',
        matchPosition: 'Matching position codes...',
        matchLine: 'Matching production line codes...',
        matchShift: 'Matching shift codes...',
        matchEmployee: 'Checking existing employees and manager codes...',
        matchAccount: 'Checking employee login accounts...',
        validateRelation:
          'Validating department, position, line, shift, manager, and account rules...',
        startImport: 'All master data matched. Starting employee import...',
        importEmployee: 'Importing employees...',
        resolveManager: 'Resolving managers...',
        createAccount: 'Creating employee login accounts...',
        syncManager: 'Finalizing line managers...',
        completed: 'Employee import completed.',
        failed:
          'Employee import failed. Please fix the Excel file and try again.',

        guideSubtitle:
          'Upload the employee Excel file and follow each import step in real time.',
        runningTitle: 'Employee import progress',
        percentDone: '{percent}% completed',
        rowProgress: '{processed} of {total} rows processed',
        fileUpload: 'File upload: {percent}%',

        statusWaiting: 'Waiting',
        statusRunning: 'Running',
        statusSuccess: 'Success',
        statusFailed: 'Failed',

        phase: {
          UPLOAD: 'Upload file',
          READ_FILE: 'Read file',
          PARSE_ROWS: 'Read rows',
          VALIDATE_BASIC: 'Validate basic fields',
          MATCH_DEPARTMENT: 'Match departments',
          MATCH_POSITION: 'Match positions',
          MATCH_LINE: 'Match lines',
          MATCH_SHIFT: 'Match shifts',
          MATCH_EMPLOYEE: 'Check employees',
          MATCH_ACCOUNT: 'Check accounts',
          VALIDATE_RELATION: 'Validate relationships',
          IMPORT_EMPLOYEE: 'Import employees',
          RESOLVE_MANAGER: 'Resolve managers',
          CREATE_ACCOUNT: 'Create accounts',
          SYNC_MANAGER: 'Sync managers',
          COMPLETE: 'Complete',
        },
      },
    },

    line: {
      tableTitle: 'Production Line List',
      searchPlaceholder: 'Search code, name, or description',

      department: 'Department',
      departments: 'Departments',
      allDepartments: 'All Departments',
      allPositions: 'All Positions',

      lineCode: 'Line Code',
      lineName: 'Line Name',
      allowedPositions: 'Allowed Positions',
      allPositionsInDepartment: 'All Positions',
      allPositionsInDepartments: 'All Positions',

      newLine: 'New Line',
      importExcel: 'Import Excel',
      exportExcel: 'Export Excel',

      createTitle: 'Create Production Line',
      editTitle: 'Edit Production Line',

      selectDepartment: 'Select department',
      selectDepartments: 'Optional: select departments',
      selectAllowedPositions: 'Optional: select allowed positions',

      codeExample: 'Example: LINE-01',
      nameExample: 'Example: Sewing Line 01',
      descriptionPlaceholder: 'Optional production line description',

      allowedPositionsMultiDepartmentHelp:
        'Leave blank for normal use. Blank departments = all departments. Blank positions = all positions.',

      exported: 'Exported',
      exportedSuccess: 'Production lines exported successfully.',
      exportFailed: 'Failed to export production lines.',

      imported: 'Imported',
      importedSuccess:
        'Import completed. Created: {created}, Updated: {updated}.',

      importTitle: 'Import Production Lines',
      importGuideTitle: 'Import guide',
      importGuideStep1: 'Download the sample file.',
      importGuideStep2:
        'Fill line code and line name. Department Codes and Position Codes are optional.',
      importGuideStep3:
        'Leave Department Codes blank for normal use. Blank = all departments.',
      importGuideStep4:
        'Leave Position Codes blank for normal use. Blank = all positions.',
      importAllOrNothingNote:
        'All rows must be 100% valid. If any row has an error, nothing will be saved.',
      importUploading: 'Uploading file... {percent}%',
      importProcessing: 'File uploaded. Validating Excel rows and saving data...',

      blankDepartmentsMeansAll: 'Blank departments = all departments',
      blankPositionsMeansAll: 'Blank positions = all positions',
      employeeLineStillExplicit: 'Employee line is selected manually',

      downloadSample: 'Download Sample',
      downloadSampleFailed: 'Download sample failed',
      sampleDownloaded: 'Sample file downloaded successfully.',

      excelFile: 'Excel file',
      chooseFile: 'Choose File',
      noFileSelected: 'No file selected',

      importInvalidFileTitle: 'Invalid file type',
      importInvalidFileMessage:
        'Please choose an Excel file only: .xlsx, .xls, or .csv.',
      importFailed: 'Import failed',

      importValidationFailed: 'Import validation failed',
      importErrorCount: '{count} error(s) found',
      importErrorListTitle: 'Fix these Excel rows before importing',
      importRow: 'Row',
      importField: 'Field',
      importValue: 'Value',
      importReason: 'Reason',
      importUnknownError: 'Unknown import error',

      noData: 'No production lines matched your filters.',
      loadFailed: 'Failed to load production lines.',
      departmentLoadFailed: 'Failed to load departments.',
      positionLoadFailed: 'Failed to load positions.',
      saveFailed: 'Failed to save production line.',
      createdSuccess: 'Production line created successfully.',
      updatedSuccess: 'Production line updated successfully.',

      field: {
        departmentId: {
          required: 'Department is optional.',
          invalid: 'Department is invalid.',
        },
        departmentIds: {
          required: 'Department is optional.',
          invalid: 'One or more selected departments are invalid.',
        },
        positionIds: {
          required: 'Position is optional.',
          invalid: 'One or more selected positions are invalid.',
        },
      },

      validation: {
        codeRequired: 'Line code is required.',
        codeTooLong: 'Line code must not be longer than 50 characters.',
        nameRequired: 'Line name is required.',
        nameTooLong: 'Line name must not be longer than 120 characters.',
        departmentRequired: 'Department is optional.',
        descriptionTooLong: 'Description must not be longer than 500 characters.',
        updatePayloadRequired: 'Please update at least one field.',
      },

      error: {
        notFound: 'Production line not found.',
        codeExists: 'Line code already exists.',
        inactive: 'Line is inactive.',
        departmentMismatch:
          'Selected line does not support this employee department.',
        positionNotAllowed:
          'Selected line does not allow this employee position.',
        positionDepartmentMismatch:
          'Selected position does not belong to selected line departments.',
        excelFileRequired: 'Excel file is required.',
        excelNoRows: 'Excel file has no rows.',
        excelNoValidRows: 'Excel file has no valid rows.',
      },

      import: {
        success: {
          completed: 'Production line import completed successfully.',
        },

        error: {
          validationFailed:
            'Import failed. Please fix all row errors and try again.',
          duplicateDatabaseCode:
            'Import failed because one or more line codes already conflict with existing data.',

          codeRequired: 'Code is required.',
          codeTooLong: 'Code must not be longer than {max} characters.',
          duplicateCode:
            'Duplicate Line Code "{code}" in Excel file. First found at row {firstRowNo}.',

          nameRequired: 'Name is required.',
          nameTooLong: 'Name must not be longer than {max} characters.',

          departmentRequired: 'Department Codes is optional.',
          departmentCodeTooLong:
            'Department Code must not be longer than {max} characters: {departmentCodes}.',
          duplicateDepartmentCodeInRow:
            'Duplicate Department Code in the same row: {departmentCodes}.',
          departmentNotFound: 'Department Code not found: {departmentCodes}.',

          positionCodeTooLong:
            'Position Code must not be longer than {max} characters: {positionCodes}.',
          duplicatePositionCodeInRow:
            'Duplicate Position Code in the same row: {positionCodes}.',
          positionNotFound:
            'Position Code not found: {positionCodes}. Position Codes must use codes from Position master, not Department codes.',
          positionDepartmentMismatch:
            'These Position Code(s) do not belong to selected Department Codes "{departmentCodes}": {positionCodes}.',

          descriptionTooLong:
            'Description must not be longer than {max} characters.',
          invalidStatus: 'Status must be Active or Inactive.',
        },
      },
    },

    orgChart: {
      searchPlaceholder: 'Search employee code or name',
      rootPerson: 'Root Person',
      selectRootPerson: 'Select root person',
      includeInactive: 'Include inactive',

      treeTitle: 'Overtime Flow',
      zoomLabel: 'Zoom: {zoom}',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      resetZoom: 'Reset',

      noEmployeeCode: 'No ID',
      noPosition: 'No Position',
      noDepartment: 'No Department',

      noTreeData: 'No organization chart data found.',
      loadFailed: 'Failed to load organization chart.',

      expandNode: 'Expand node',
      collapseNode: 'Collapse node',
    },
  },

  employee: {
    error: {
      notFound: 'Employee not found.',
      inactive: 'Employee is inactive.',
    },
  },

  calendar: {
    holidayPicker: {
      selectDate: 'Select date',
      loadingHolidays: 'Loading holidays...',
      activeHolidayCount: '{count} active holiday(s)',
      sunday: 'Sunday',
      workingDay: 'Working Day',
      holiday: 'Holiday',
      today: 'Today',
      clear: 'Clear',

      week: {
        sun: 'Sun',
        mon: 'Mon',
        tue: 'Tue',
        wed: 'Wed',
        thu: 'Thu',
        fri: 'Fri',
        sat: 'Sat',
      },
    },

    holiday: {
      tableTitle: 'Holiday Calendar',
      previewTitle: 'Calendar Preview',
      previewCount: 'Holidays',
      activeHolidays: 'active holiday(s)',
      selectedDate: 'Selected Date',

      searchPlaceholder: 'Search code, name, or description',
      noData: 'No holidays found.',
      loadFailed: 'Failed to load holidays.',

      importExcel: 'Import Excel',
      exportExcel: 'Export Excel',
      newHoliday: 'New Holiday',
      createTitle: 'Create Holiday',
      editTitle: 'Edit Holiday',
      createOnSelectedDate: 'Create',
      editHoliday: 'Edit',

      selectHolidayDate: 'Select holiday date',
      holidayCode: 'Holiday Code',
      codeExample: 'Example: KHNY',
      holidayName: 'Holiday Name',
      nameExample: 'Example: Khmer New Year',
      descriptionPlaceholder: 'Optional note or description',
      selectedDayType: 'Selected day type',

      paidHoliday: 'Paid Holiday',
      paidHolidayHelp: 'Use this when the holiday is paid.',
      activeHelp:
        'Inactive holidays will not be used for day-type classification.',
      paid: 'Paid',
      unpaid: 'Unpaid',
      noCode: 'No Code',

      createdSuccess: 'Holiday created successfully.',
      updatedSuccess: 'Holiday updated successfully.',
      saveFailed: 'Failed to save holiday.',

      exported: 'Exported',
      exportedSuccess: 'Holiday Excel exported successfully.',
      exportFailed: 'Failed to export holidays.',

      imported: 'Imported',
      importedSuccess:
        'Import completed. Created: {created}, Updated: {updated}.',

      importTitle: 'Import Holidays',
      importInvalidFileTitle: 'Invalid file type',
      importInvalidFileMessage:
        'Please choose an Excel file only: .xlsx, .xls, or .csv.',
      importFailed: 'Failed to import holidays.',

      importGuideTitle: 'Import guide',
      importGuideStep1: 'Download the sample file.',
      importGuideStep2:
        'Fill in holiday date, code, name, paid holiday, and active status.',
      importGuideStep3: 'Use DD/MM/YYYY format for dates.',
      importGuideStep4: 'Upload the completed file.',
      importNote:
        'Existing holidays with the same date will be updated. Users do not need Mongo IDs in Excel.',

      downloadSample: 'Download Sample',
      sampleDownloaded: 'Sample file downloaded successfully.',
      downloadSampleFailed: 'Failed to download sample file.',

      excelFile: 'Excel file',
      chooseFile: 'Choose File',
      noFileSelected: 'No file selected',

      validation: {
        dateInvalid: 'Holiday date is invalid.',
        codeTooLong: 'Holiday code must not be longer than 50 characters.',
        nameRequired: 'Holiday name is required.',
        nameTooLong: 'Holiday name must not be longer than 150 characters.',
        descriptionTooLong:
          'Description must not be longer than 1000 characters.',
        updatePayloadRequired: 'Please update at least one field.',
      },

      error: {
        invalidDate: 'Invalid holiday date.',
        dateExists: 'A holiday already exists for this date.',
        notFound: 'Holiday not found.',
        excelFileRequired: 'Excel file is required.',
        excelNoRows: 'Excel file has no rows.',
      },

      import: {
        success: {
          completed: 'Holiday import completed successfully.',
        },

        error: {
          dateRequired: 'Date is required. Use DD/MM/YYYY format.',
          nameRequired: 'Holiday name is required.',
          invalidPaidHoliday:
            'Paid Holiday must be Yes or No. Blank will be treated as Yes.',
          invalidStatus:
            'Status must be Active or Inactive. Blank will be treated as Active.',
          duplicateDate:
            'Duplicate holiday date "{date}" in the import file at row {rowNo}.',
        },
      },
    },
  },

  shift: {
    tableTitle: 'Shift List',

    type: {
      day: 'Day',
      night: 'Night',
    },

    filter: {
      searchPlaceholder: 'Search code or name',
      type: 'Type',
      allTypes: 'All Types',
    },

    action: {
      newShift: 'New Shift',
      createShift: 'Create Shift',
      importExcel: 'Import Excel',
      exportExcel: 'Export Excel',
    },

    column: {
      code: 'Code',
      name: 'Name',
      type: 'Type',
      start: 'Start',
      breakStart: 'Break Start',
      breakEnd: 'Break End',
      end: 'End',
      crossMidnight: 'Cross Midnight',
      working: 'Working',
    },

    table: {
      empty: 'No shifts matched your filters.',
    },

    dialog: {
      createTitle: 'Create Shift',
      editTitle: 'Edit Shift',
    },

    form: {
      code: 'Shift Code',
      name: 'Shift Name',
      type: 'Shift Type',
      startTime: 'Start Time',
      breakStartTime: 'Break Start Time',
      breakEndTime: 'Break End Time',
      endTime: 'End Time',
      activeStatus: 'Active Status',

      codePlaceholder: 'Example: DAY-0700',
      namePlaceholder: 'Example: Day Shift 07:00 - 16:00',
      typePlaceholder: 'Select shift type',

      timeHint:
        'Use HH:mm format. Example: 07:00, 12:00, 13:00, 16:00. DAY shift cannot cross midnight. NIGHT shift must cross midnight.',
    },

    duration: {
      hours: '{hours}h',
      minutes: '{minutes} min',
      hoursMinutes: '{hours}h {minutes}m',
    },

    permission: {
      noView: 'You do not have permission to view shifts.',
    },

    toast: {
      loadFailedDetail: 'Failed to load shifts.',
      createdDetail: 'Shift created successfully.',
      updatedDetail: 'Shift updated successfully.',
      saveFailedDetail: 'Failed to save shift.',

      exportedTitle: 'Exported',
      exportedDetail: 'Shift Excel exported successfully.',
      exportFailedTitle: 'Export failed',
      exportFailedDetail: 'Failed to export shifts.',
    },

    import: {
      title: 'Import Shifts',
      guideTitle: 'Import guide',
      guideStep1: 'Download the sample file.',
      guideStep2: 'Fill your shift data using the same format.',
      guideStep3: 'Use DAY or NIGHT for shift type.',
      guideStep4:
        'Use HH:mm format for Start Time, Break Start Time, Break End Time, and End Time.',
      guideStep5: 'Choose the completed Excel file and click Import.',

      downloadSample: 'Download Sample',
      sampleDownloaded: 'Sample file downloaded successfully.',

      fileLabel: 'Excel file',
      chooseFile: 'Choose File',
      noFileSelected: 'No file selected',

      invalidExcelData: 'Invalid Excel data',
      importApiNotFound: 'Import API not found',
      duplicateData: 'Duplicate data',
      serverError: 'Server error',

      helpCodeRequired: 'Please enter a shift code.',
      helpType: 'Shift Type must be DAY or NIGHT.',
      helpStartTime: 'Start Time must use HH:mm format, for example 07:00.',
      helpBreakStartTime:
        'Break Start Time must use HH:mm format, for example 12:00.',
      helpBreakEndTime:
        'Break End Time must use HH:mm format, for example 13:00.',
      helpEndTime: 'End Time must use HH:mm format, for example 16:00.',
      helpCrossMidnight:
        'DAY shift cannot cross midnight. NIGHT shift must cross midnight.',
      helpBreakInside: 'Break time must stay inside the shift working time.',
      helpDuplicateCode:
        'Shift code must be unique. Please change the duplicate code.',

      toast: {
        invalidFileTitle: 'Invalid file type',
        invalidFileDetail:
          'Please choose an Excel file only: .xlsx, .xls, or .csv.',

        importFailedTitle: 'Import failed',
        importFailedDetail: 'Failed to import shifts.',

        importedTitle: 'Imported',
        importedDetail:
          'Import completed. Total: {total}, Created: {created}, Updated: {updated}.',
      },

      success: {
        completed: 'Shift import completed successfully.',
      },

      error: {
        invalidStatus: 'Status must be Active or Inactive.',
        rowInvalid: 'Invalid shift data.',
        duplicateShiftId: 'Duplicate Shift ID in the import file.',
        duplicateCode: 'Duplicate Shift Code in the import file.',
        shiftIdNotFound: 'Shift ID was not found.',
      },
    },

    validation: {
      shiftIdInvalid: 'Shift ID is invalid.',
      codeRequired: 'Shift code is required.',
      codeTooLong: 'Shift code must not be longer than 30 characters.',
      nameRequired: 'Shift name is required.',
      nameTooLong: 'Shift name must not be longer than 120 characters.',
      typeInvalid: 'Shift type must be DAY or NIGHT.',
      startTimeInvalid: 'Start time must use HH:mm format.',
      breakStartTimeInvalid: 'Break start time must use HH:mm format.',
      breakEndTimeInvalid: 'Break end time must use HH:mm format.',
      endTimeInvalid: 'End time must use HH:mm format.',
      endTimeRequired: 'Shift end time is required.',
      isActiveInvalid: 'Status is invalid.',
      updatePayloadRequired: 'Please update at least one field.',
    },

    error: {
      notFound: 'Shift not found.',
      inactive: 'Shift is inactive.',
      codeExists: 'Shift code already exists.',
      startEndSame: 'Shift start time and end time cannot be the same.',
      breakStartEndSame:
        'Break start time and break end time cannot be the same.',
      dayCannotCrossMidnight: 'DAY shift cannot cross midnight.',
      nightMustCrossMidnight: 'NIGHT shift must cross midnight.',
      breakEndBeforeStart:
        'Break end time must be later than break start time.',
      breakOutsideShift: 'Break time must be inside shift working time.',
      excelFileRequired: 'Excel file is required.',
      excelNoRows: 'Excel file has no rows.',
    },
  },

  attendance: {
    title: 'Attendance',
    importTitle: 'Attendance Import',
    recordsTitle: 'Attendance Records',
    verificationTitle: 'OT Attendance Verification',

    importDialog: {
      title: 'Import Attendance',
      guideTitle: 'Import guide',
      guideStep1: 'Select attendance date from the holiday-aware calendar.',
      guideStep2: 'Download the sample file.',
      guideStep3: 'Fill only Employee ID, Clock In, and Clock Out exactly like the sample.',
      guideStep4: 'Choose the file and import. Duplicate/error rows will reject the whole import, and the file replaces that attendance date.',
      note:
        'Attendance date is selected in the dialog. The Excel sample does not need a date column. Import replaces the selected attendance date, so employees missing from the new file are removed for that date.',

      downloadSample: 'Download Sample',
      sampleDownloaded: 'Sample file downloaded successfully.',
      downloadFailed: 'Download failed',

      importCompleted: 'Import completed',
      importCompletedSuccess: 'Attendance imported successfully.',
      importCompletedPartial:
        'Attendance imported with some skipped or invalid rows.',
      importFailed: 'Import failed',

      validation: 'Validation',
      invalidFile: 'Invalid file',
      invalidExcelData: 'Invalid Excel data',
      importApiNotFound: 'Import API not found',
      duplicateData: 'Duplicate data',
      serverError: 'Server error',

      chooseExcelFile: 'Please choose an Excel file.',
      invalidExcelFile:
        'Please upload Excel file only: .xlsx, .xls, or .csv.',
      fileTooLarge: 'File size must not exceed 10 MB.',
      selectAttendanceDate: 'Please select attendance date.',
      failedDownloadSample: 'Failed to download sample file.',
      failedImportFile: 'Failed to import attendance file.',

      checkEmployeeMaster: 'Please check the Employee master data.',
      checkShiftMaster: 'Please check the Shift master data.',
      dateFormatHelp: 'Please check the date format in the Excel file.',
      timeFormatHelp: 'Please use HH:mm format for time values.',

      excelFile: 'Excel file',
      chooseFile: 'Choose File',
      noFileSelected: 'No file selected',
    },

    import: {
      importAttendance: 'Import Attendance',
      latestImportResult: 'Latest Import Result',
      latestImportDescription:
        'Latest uploaded file has been processed by the backend import engine.',
      failedRowPreview: 'Failed Row Preview',
      importHistory: 'Import History',
      importDetail: 'Attendance Import Detail',
      loadingImportDetail: 'Loading import detail...',
      noImportDetail: 'No detail found.',
      noImportRecords: 'No imported records in this detail.',
      noImports: 'No attendance imports matched your filters.',
      detailLoadFailed: 'Failed to load attendance import detail.',
    },

    records: {
      attendanceList: 'Attendance List',
      noRecords: 'No attendance records matched your filters.',
      loadFailed: 'Failed to load attendance records.',
    },

    field: {
      attendanceDate: 'Attendance Date',
      selectAttendanceDate: 'Select attendance date',

      importNo: 'Import No',
      fileName: 'File Name',
      period: 'Period',
      periodFrom: 'Period From',
      periodTo: 'Period To',
      row: 'Row',
      rows: 'Rows',

      totalRows: 'Total Rows',
      successRows: 'Success',
      failedRows: 'Failed',
      duplicateRows: 'Duplicate',
      overriddenRows: 'Overridden',
      importedAt: 'Imported At',

      employee: 'Employee',
      employeeNo: 'Employee No',
      importedEmployee: 'Imported',
      department: 'Department',
      position: 'Position',
      line: 'Line',
      shift: 'Shift',

      scanIn: 'Scan In',
      scanOut: 'Scan Out',
      clockIn: 'Clock In',
      clockOut: 'Clock Out',

      status: 'Status',
      importedStatus: 'Imported Status',
      derivedStatus: 'Derived Status',
      shiftStatus: 'Shift Status',
      shiftMatch: 'Shift Match',
      dayType: 'Day Type',

      worked: 'Worked',
      late: 'Late',
      earlyOut: 'Early Out',
      issues: 'Issues',

      searchImportPlaceholder: 'Search import no, file name, or remark',
      searchRecordsPlaceholder: 'Search employee, imported name, or reason',
    },

    option: {
      allDerivedStatus: 'All Derived Status',
      allImportedStatus: 'All Imported Status',
      allShiftStatus: 'All Shift Status',
      allDayTypes: 'All Day Types',
    },

    statusLabel: {
      processing: 'Processing',
      success: 'Success',
      partialSuccess: 'Partial Success',
      failed: 'Failed',

      present: 'Present',
      late: 'Late',
      absent: 'Absent',
      forgetScanIn: 'Forget Scan In',
      forgetScanOut: 'Forget Scan Out',
      shiftMismatch: 'Wrong Shift',
      leave: 'Leave',
      off: 'Off',
      unknown: 'Unknown',

      valid: 'Valid',
      imported: 'Imported',
      error: 'Error',
      invalid: 'Invalid',
      warning: 'Warning',
      duplicate: 'Duplicate',
      pending: 'Pending',
      cancelled: 'Cancelled',
      draft: 'Draft',

      matched: 'Matched',
      mismatch: 'Mismatch',

      workingDay: 'Working Day',
      sunday: 'Sunday',
      holiday: 'Holiday',
      missing: 'Missing',
    },

    message: {
      loadFailed: 'Load failed',
      detailLoadFailed: 'Detail load failed',
      missingImportId: 'Missing import ID',
      missingImportIdDetail:
        'Cannot open this import detail because ID is missing.',
      noDataFound: 'No data found',
      updating: 'Updating',
      failedRowsWarning:
        'Some rows failed or were skipped. Review the failed row list below.',
      partialImportWarning:
        'Attendance was imported with some skipped, duplicated, or invalid rows.',
    },

    result: {
      employee_not_matched: 'Employee is not matched to Employee master.',
      leave: 'Imported status is Leave and there are no punches.',
      off: 'Imported status is Off and there are no punches.',
      absent: 'No clock in and no clock out.',
      forget_scan_in: 'Clock out exists but clock in is missing.',
      forget_scan_out: 'Clock in exists but clock out is missing.',
      shift_mismatch: 'Punches do not align with the assigned shift.',
      late: 'Clock in is later than the assigned shift start.',
      present: 'Clock in/out align with the assigned shift.',
      unknown: 'Unable to derive attendance result.',
      invalid_clock_format: 'Clock in/out format is invalid.',
      invalid_shift_time: 'Assigned shift time is missing or invalid.',
    },

    verification: {
      otDate: 'OT Date',
      selectOtDate: 'Select OT date',
      searchOtRequest: 'Search OT Request',
      selectOtRequest: 'Select OT request',
      requestStatus: 'Request Status',
      results: 'Result',
      

      allResults: 'All Results',
      matched: 'Matched',
      acceptedByPolicy: 'Accepted by Policy',
      needsCheck: 'Needs Check',
      forgetScanIn: 'Forget Scan In',
      forgetScanOut: 'Forget Scan Out',
      otStaffAbsent: 'OT Staff Absent',
      wrongShift: 'Wrong Shift',
      notInOtStaff: 'Not in OT Staff',
      notEligible: 'Not Eligible',

      requestStaff: 'Request Staff',
      forgetIn: 'Forget In',
      forgetOut: 'Forget Out',
      absent: 'Absent',
      notInOt: 'Not in OT',

      nonFinalWarning:
        'This OT request is currently {status}. You can verify for checking, but final OT payment should follow the final approved request.',

      requestNo: 'Request No',
      requester: 'Requester',
      shift: 'Shift',
      expectedOt: 'Expected OT',
      requested: 'Requested',
      policy: 'Policy',

      verificationResult: 'Verification Result',
      loadingVerification: 'Loading OT attendance verification...',
      rowCount: '{count} rows',
      searchPlaceholder: 'Search employee, result, or reason',

      resultLabel: 'Result',
      meaning: 'Meaning',
      employee: 'Employee',
      otType: 'OT Type',
      scanIn: 'Scan In',
      scanOut: 'Scan Out',
      status: 'Status',
      creditedOt: 'Credited OT',
      actual: 'Actual',
      reason: 'Reason',

      fixedOt: 'Fixed OT',
      afterShift: 'After Shift',
      otOption: 'OT Option',

      noVerificationRows: 'No verification rows found.',
      emptyInstruction:
        'Select an OT date, choose an OT request, then verify attendance result.',

      otDateRequired: 'OT date required',
      otDateRequiredDetail: 'Please select OT date first.',
      noOtRequests: 'No OT requests',
      noOtRequestsDetail:
        'No OT request found for the selected date and status.',
      loadFailed: 'Load failed',
      loadVerificationFailed: 'Failed to load OT attendance verification.',
      loadRequestsFailed: 'Failed to load OT requests.',

      noRequestNo: 'No Request No',
      statusPrefix: 'Status',
      staff: 'staff',

      result: {
        match: 'Matched',
        mismatch: 'Needs check',
        pending_review: 'Pending review',
      },

      no_paid_ot_minutes: 'No paid OT minutes found on approved OT request.',
      approved_without_exact_clock_out:
        'Approved OT credited by policy. Employee attended normal shift. Exact OT end scan is not required.',
      approved_without_exact_clock_out_late:
        'Approved OT credited by policy. Employee was late but attended normal shift. Exact OT end scan is not required.',
      fixed_ot_approved_without_exact_clock_out:
        'Fixed OT credited by policy. Employee attended normal shift. Exact OT end scan is not required.',
      fixed_ot_approved_without_exact_clock_out_late:
        'Fixed OT credited by policy. Employee was late but attended normal shift. Exact OT end scan is not required.',

      forget_scan_in_pending: 'Forget scan in is pending review by OT policy.',
      forget_scan_out_pending:
        'Forget scan out is pending review by OT policy.',
      attendance_not_present:
        'Approved OT is not credited because attendance is not present.',
      status_requires_manual_review:
        'Attendance status requires manual review before OT can be credited.',

      no_request_window: 'OT request time window is missing or invalid.',
      no_attendance_window: 'Clock in/out window is missing or invalid.',

      sunday_holiday_no_overlap:
        'No attended time overlaps with the Sunday or holiday OT request.',
      sunday_holiday_below_min:
        'Sunday or holiday OT is below the minimum eligible minutes.',
      sunday_holiday_match:
        'Sunday or holiday OT matched the approved request.',
      sunday_holiday_short:
        'Sunday or holiday OT is shorter than the approved request.',
      sunday_holiday_exceed:
        'Sunday or holiday OT is more than the approved request.',

      policy_not_eligible: 'OT is not eligible under the selected policy.',
      policy_below_min:
        'OT is below the minimum eligible minutes in the policy.',
      policy_match: 'OT matched the approved request by policy.',
      policy_short:
        'Credited OT is less than the approved request by policy.',
      policy_exceed:
        'Credited OT is more than the approved request by policy.',

      meaningLabel: {
        forgetScanIn: 'Forget Scan In',
        forgetScanOut: 'Forget Scan Out',
        acceptedByPolicy: 'Accepted by policy',
        otStaffAbsent: 'OT staff absent',
        wrongShift: 'Wrong shift',
        notInOtStaff: 'Not in OT staff',
        notEligible: 'Not eligible for OT',
        otMatchedRequest: 'OT matched request',
        absent: 'Absent',
        missingScanTime: 'Missing scan time',
        noCreditedOt: 'No credited OT',
        creditedLessThanRequest: 'Credited less than request',
        creditedOverRequest: 'Credited over request',
        adjustedByRule: 'Adjusted by rule',
        checkOtRule: 'Check OT rule',
      },
    },

    validation: {
      invalidId: 'Invalid ID.',
      dateYmd: 'Date must be in YYYY-MM-DD format.',
      attendanceDateRequired: 'Attendance date is required.',
      attendanceDateToAfterFrom:
        'Attendance date to must be greater than or equal to attendance date from.',
      periodToAfterFrom:
        'Period to must be greater than or equal to period from.',
      otDateToAfterFrom:
        'OT date to must be greater than or equal to OT date from.',
    },

    error: {
      importFileRequired: 'Attendance Excel file is required.',
      importFileInvalid: 'Attendance file is empty or invalid.',
      unableToReadFile: 'Unable to read attendance file.',
      worksheetMissing: 'Attendance file does not contain any worksheet.',
      worksheetEmpty: 'Attendance worksheet is empty.',
      headerMissing: 'Attendance worksheet header row was not found.',
      employeeIdColumnRequired:
        'Attendance file must contain an Employee ID column.',
      clockInColumnRequired:
        'Attendance file must contain a Clock In column.',
      clockOutColumnRequired:
        'Attendance file must contain a Clock Out column.',
      importNotFound: 'Attendance import not found.',
      recordNotFound: 'Attendance record not found.',
      otRequestNotFound: 'OT request not found.',
    },
  },

  ot: {
    common: {
      min: 'min',
      minShort: 'm',
      totalCount: '{total} total',
      hourValue: '{value}h',
      minuteValue: '{value} min',
      hourMinuteValue: '{hours}h {minutes}m',
    },

    dayType: {
      workingDay: 'Working Day',
      sunday: 'Sunday',
      holiday: 'Holiday',
    },

    status: {
      pending: 'Pending',
      pendingRequesterConfirmation: 'Pending Requester Confirmation',
      approved: 'Approved',
      rejected: 'Rejected',
      requesterDisagreed: 'Requester Disagreed',
      cancelled: 'Cancelled',
    },

    approvalDisplay: {
      approved: 'Approved',
      rejected: 'Rejected',
      waitingRequesterConfirmation: 'Waiting for requester confirmation',
      requesterDisagreed: 'Requester disagreed',
      cancelled: 'Cancelled',
      waitingApproval: 'Waiting for approval',
    },

    acknowledgement: {
      status: {
        acknowledged: 'Acknowledged',
        waiting: 'Waiting',
        pending: 'Pending',
        fyi: 'FYI',
      },
    },

    acknowledge: {
      inbox: 'OT Acknowledge Inbox',
      loading: 'Loading acknowledgement inbox',
      fetchingRecords: 'Fetching acknowledgement OT requests...',
      noData: 'No acknowledgement requests found.',
      loadFailed: 'Failed to load acknowledgement inbox.',
      acknowledgement: 'Acknowledgement',
      requestStatus: 'Request Status',
      fyi: 'FYI',
    },

    approval: {
      inbox: 'OT Approval Inbox',
      approvalStatus: 'Approval Status',
      staffCount: '{count} staff',
      time: 'Time',

      exportExcel: 'Export Excel',
      approveSelected: 'Approve Selected',
      approveSelectedWithCount: 'Approve Selected ({count})',
      clearSelection: 'Clear Selection',

      loading: 'Loading approval inbox',
      fetchingRecords: 'Fetching OT approval requests...',
      noData: 'No OT approval requests found.',
      loadFailed: 'Failed to load approval inbox.',

      exported: 'Exported',
      exportedSuccess: 'Approval inbox Excel exported successfully.',
      exportFailed: 'Export failed',

      requestedStaff: 'Requested Staff',
      requested: 'Requested',
      breakTime: 'Break Time',
      totalRequestPaid: 'Total Request Paid',
      paid: 'Paid',
      totalPaid: 'Total Paid',

      legacyManual: 'Legacy Manual',
      shiftOption: 'Shift Option',

      noSelectedRequests: 'No selected requests',
      selectAtLeastOne: 'Please select at least one actionable OT request.',

      decisionEyebrow: 'OT approval decision',
      confirmApproval: 'Confirm Approval',
      rejectRequest: 'Reject OT Request',
      approveQuestion: 'Are you sure you want to approve?',
      rejectQuestion: 'Are you sure you want to reject?',
      approveHelp: 'This will approve all employees inside this OT request.',
      rejectHelp: 'This will reject the whole OT request.',

      remark: 'Remark',
      optionalApprovalRemark: 'Optional approval remark',
      rejectionReasonPlaceholder: 'Please enter rejection reason',
      rejectionRemarkRequired: 'Please enter rejection remark.',
      yesApprove: 'Yes, Approve',

      decisionSuccess: 'Success',
      approveSuccess: 'OT request approved successfully.',
      rejectSuccess: 'OT request rejected successfully.',
      decisionFailed: 'Decision failed',

      bulkApproval: 'Bulk approval',
      approveMultiple: 'Approve multiple OT requests',
      requestCount: '{count} request(s)',
      bulkWarning:
        'Are you sure you want to approve the selected OT requests? This will approve all employees inside each selected request.',
      bulkRemarkPlaceholder: 'Optional remark for all selected approvals',
      approveAllSelected: 'Approve All Selected',

      bulkCompleted: 'Bulk approval completed',
      bulkPartial: '{success} approved, {failed} failed.',
      bulkSuccess: '{count} request(s) approved successfully.',
      bulkFailed: 'Bulk approval failed',
      bulkNoApproved: 'No request was approved.',
    },

    requests: {
      tableTitle: 'My OT Requests',
      title: 'My OT Requests',
      createTitle: 'Create OT Request',
      editTitle: 'Edit OT Request',
      detailTitle: 'OT Request Detail',
      approvalTitle: 'OT Approval Inbox',
      acknowledgeTitle: 'OT Acknowledge Inbox',
      subtitle: 'View and manage only the OT requests you created.',

      requestNo: 'Request No.',
      otDate: 'OT Date',
      otDateFrom: 'OT Date From',
      otDateTo: 'OT Date To',
      otTime: 'OT Time',
      time: 'Time',
      dayType: 'Day Type',
      otOption: 'OT Option',

      employee: 'Employee',
      employees: 'Employees',
      approver: 'Approver',
      requester: 'Requester',
      requestedMinutes: 'Requested Minutes',
      paidMinutes: 'Paid Minutes',
      breakMinutes: 'Break Minutes',
      break: 'Break',
      total: 'OT time',
      mode: 'Mode',

      exportExcel: 'Export Excel',
      newRequest: 'New OT Request',

      deleteConfirmTitle: 'Delete OT request',
      deleteConfirmHeading: 'Delete this OT request permanently?',
      deleteConfirmHelp:
        'This will permanently remove the OT request and its related notifications. Use this only for test or agreed cleanup records.',
      deletedSuccess: 'OT request deleted successfully.',
      deleteFailed: 'Delete failed.',

      allDayTypes: 'All Day Types',

      loading: 'Loading my OT requests',
      fetchingRecords: 'Fetching my OT request records...',
      noData: 'No OT requests found for you.',
      loadFailed: 'Failed to load my OT requests.',

      exported: 'Export ready',
      exportedSuccess: 'My OT requests Excel file downloaded successfully.',
      exportFailed: 'Export failed',

      approvalStatus: 'Approval Status',
      staff: 'Staff',
      staffCount: '{count} staff',
      timing: 'Timing',
      verify: 'Verify',

      preset: 'Preset',
      customFixed: 'Custom',

      defaultRequestTime: 'Default request time',
      employeeId: 'ID',
      noEmployeeData: 'No employee data found for this request.',

      timeMode: {
        default: 'Default',
        custom: 'Custom',
      },

      edit: {
        title: 'Edit OT Request',
        subtitle:
          'Requester can edit only before any approval step becomes approved.',
        saveChanges: 'Save Changes',

        loadingDetail: 'Loading OT request...',
        notFound: 'OT request not found.',

        legacyManualMode: 'Legacy Manual Mode',
        shiftOtOptionMode: 'Shift OT Option Mode',

        editForm: 'Edit Form',
        currentSummary: 'Current Summary',
        employeesInRequest: 'Employees in This Request',

        requesterId: 'Requester ID',
        startTime: 'Start Time',
        endTime: 'End Time',
        reason: 'Reason',
        approverChain: 'Approver Chain',
        selectApprovers: 'Select approvers in hierarchy order',
        selectOtOption: 'Select OT option',

        shiftType: 'Shift Type',
        shiftStart: 'Shift Start',
        shiftEnd: 'Shift End',

        requestedDuration: 'Requested Duration',
        requestStart: 'Request Start',
        requestEnd: 'Request End',

        currentRequestTime: 'Current Request Time',
        currentTotalHours: 'Current Total Hours',
        currentOtOption: 'Current OT Option',

        employeeListNote:
          'This version keeps the current employee list and updates OT details, reason, and approver chain.',

        cannotEditMessage:
          'This OT request cannot be edited because it is no longer pending or it already has an approved step.',

        noShiftOption: 'No active OT option is configured for this shift yet.',

        minutesValue: '{value} min',

        validationTitle: 'Validation',
        editUnavailableTitle: 'Edit unavailable',
        editUnavailableDetail: 'This OT request can no longer be edited.',
        selectDateRequired: 'Please select OT date.',
        reasonRequired: 'Please enter reason.',
        employeeRequired: 'At least 1 employee is required.',
        approverRequired: 'Please select at least 1 approver.',
        approverMax: 'You can select up to 4 approvers only.',
        startTimeInvalid: 'Start time must be HH:mm.',
        endTimeInvalid: 'End time must be HH:mm.',
        endTimeAfterStart: 'End time must be later than start time.',
        otOptionRequired: 'Please select OT option.',

        optionsFailedTitle: 'OT options failed',
        optionsFailedDetail: 'Unable to load OT options for this shift.',
        loadFailedDetail: 'Failed to load OT request.',
        updatedSuccess: 'OT request updated successfully.',
        updateFailedDetail: 'Failed to update OT request.',
      },

      create: {
        selectedCount: '{count} selected',

        selectOtDate: '1. Select OT Date',
        timingType: '3. Timing Type',
        presetOption: 'Preset option',
        customFixedTime: 'Custom fixed time',
        otOptionPolicy: '2. OT Time',
        selectTimingType: 'Select timing type',
        selectOtOption: 'Select OT option',

        customDefaultTime: 'Custom default OT time',
        flexible: 'Flexible',

        startTime: 'Start Time',
        endTime: 'End Time',
        breakMinutes: 'Break Minutes',
        otTime: 'OT Time',

        timing: 'Timing',
        start: 'Start',
        end: 'End',
        total: 'Total',
        submitRequest: 'Submit OT Request',

        reason: 'Reason',
        optional: 'Optional',
        reasonPlaceholder:
          'Example: urgent production order, shipment deadline...',

        validationTitle: 'Check form',
        waitAvailability: 'Please wait until OT availability check finishes.',
        selectDateFirst: 'Please select OT date first.',
        selectAtLeastOneEmployee: 'Please select at least 1 employee.',
        missingShift:
          'Some selected employees do not have assigned shift information.',
        mixedShift:
          'Please select employees from one shift only before creating OT request.',
        selectOtOptionForDayType: 'Please select OT option for {dayType}.',
        selectOtOptionRequired: 'Please select OT option.',
        enterCustomStartTime: 'Please enter custom start time.',
        enterCustomEndTime: 'Please enter custom end time.',
        customStartInvalid:
          'Custom start time must be HH:mm, for example 18:00.',
        customEndInvalid:
          'Custom end time must be HH:mm, for example 20:00.',
        customTimeInvalid: 'Custom start and end time must be HH:mm.',
        customTimeSame: 'Custom start time and end time cannot be the same.',
        breakTooLong:
          'Break minutes cannot be greater than or equal to OT duration.',
        selectValidTiming: 'Please select valid OT timing before submitting.',
        missingEmployeeStart: 'Missing OT start time for {employee}.',
        missingEmployeeEnd: 'Missing OT end time for {employee}.',
        employeeStartInvalid: 'Invalid OT start time for {employee}.',
        employeeEndInvalid: 'Invalid OT end time for {employee}.',
        employeeTimeSame:
          'OT start time and end time cannot be the same for {employee}.',
        employeeBreakTooLong:
          'Break minutes cannot be greater than or equal to OT duration for {employee}.',

        profileLoadFailed: 'Profile load failed',
        profileLoadFailedDetail: 'Unable to load your employee profile.',

        availabilityFailed: 'OT availability check failed',
        availabilityFailedDetail:
          'Unable to check existing OT employees for this date.',

        optionsFailed: 'OT options failed',
        optionsFailedDetail:
          'Unable to load OT options for the selected shift and date.',

        noOptionTitle: 'No OT option',
        noOptionForDayType:
          'No active OT option found for {dayType}. Please ask admin to create one.',
        noOptionGeneric: 'No active OT option found for this shift/date.',

        calendarUnavailableTitle: 'Holiday calendar unavailable',
        calendarUnavailableDetail:
          'Unable to load internal holiday calendar.',

        employeesRemoved: 'Employees removed',
        employeesRemovedDetail:
          '{count} employee(s) already have OT request on this date and were removed from selection.',

        successTitle: 'Created',
        successMessage: 'OT request created successfully.',
        createFailedDetail: 'Unable to create OT request.',

        duplicateTitle: 'Duplicate OT employees',
        duplicateGeneric: 'Some employees already have OT request on this date.',
        duplicateDetail:
          'These employees already have OT request on this date and were removed from selection: {preview}.',
        duplicateDetailMore:
          'These employees already have OT request on this date and were removed from selection: {preview}, and {more} more.',

        missingClockInTitle: 'Attendance time-in required',
        todayAttendanceRequired:
          'Today OT requires attendance time-in before creating the request.',
        missingClockInDetail:
          'Today OT requires attendance time-in. Removed from selection: {preview}.',
        missingClockInDetailMore:
          'Today OT requires attendance time-in. Removed from selection: {preview}, and {more} more.',

        accountEmployeeLinkRequired:
          'Your login account is not linked to an employee profile. Please check Account and Employee setup.',
        approverNotFound:
          'No OT approver found in the organization chart. Please set manager chain and OT Role = Approver.',
        duplicateEmployeeDate:
          'Some employees already have OT request on this date.',

        timingMode: {
          customFixed: 'Custom Fixed Time',
          fixedTime: 'Fixed Time',
          afterShiftEnd: 'After Shift End',
        },

        employeePicker: {
          title: '3. Choose employees',
          searchPlaceholder: 'Search ID, name, line, position, or shift...',
          scopePlaceholder: 'Employee scope',

          myEmployees: 'My employees',
          allEmployees: 'All employees',
          allLines: 'All lines',

          noLine: 'No Line',
          unnamedLine: 'Unnamed line',
          noShift: 'No shift',
          noEmployeeId: 'No ID',

          chooseDateFirst: 'Choose OT date first.',
          checkingBlocked:
            'Checking employees already used in OT on this date...',
          loadingEmployees: 'Loading employees...',
          autoSelecting: 'Auto-selecting employees with line...',

          emptyTitle: 'No employees found',
          emptyText: 'Try another keyword, line filter, or employee scope.',

          staffCount: '{count} staff',
          groupSelectedCount: '{selected}/{total} selected',
          unavailableCount: '{count} unavailable',
          manualOnly: 'Manual only',
          manualSelect: 'Manual Select',
          available: 'Available',
          selected: 'Selected',

          columnStart: 'Start',
          columnEnd: 'End',

          resetDefaultTime: 'Reset to default time',
          scrollMoreLocal:
            'Scroll inside this line to show more employees...',
          loadingMore: 'Loading more employees...',
          allMatchedLoaded: 'All matched employees loaded.',

          cannotSelectTitle: 'Cannot select',
          noSelectableInGroup: 'No selectable employee in this group.',
          cannotSelectEmployeeTitle: 'Cannot select employee',
          cannotEditEmployeeTitle: 'Cannot edit employee',

          lineFilterUnavailableTitle: 'Line filter unavailable',
          lineFilterUnavailableDetail: 'Unable to load line filter options.',

          employeeLoadFailedTitle: 'Employee load failed',
          employeeLoadFailedDetail: 'Unable to load employees.',

          autoSelectFailedTitle: 'Auto select failed',
          autoSelectFailedDetail: 'Unable to auto-select your employees.',

          unknownError: 'Unknown error.',
          invalidValue: 'Invalid value',

          invalidEmployee: 'Invalid employee.',
          alreadyInRequest: 'Already in OT request {requestNo}',
          alreadyUnavailable: 'Already unavailable for this date.',
          employeeNoShift: 'Employee has no shift.',
          noLineNotEligible: 'Employee has no production line, so they cannot be selected for OT.',
          shiftMismatch: 'Employee shift does not match selected shift.',
        },
      },
    },

    policy: {
      tableTitle: 'OT Calculation Policies',
      subtitle:
        'Backend-driven OT calculation rules used by shift OT options and payment verification.',
      searchPlaceholder: 'Search code, name, or description',

      newPolicy: 'New Policy',
      createTitle: 'Create OT Policy',
      editTitle: 'Edit OT Policy',

      policy: 'Policy',
      rounding: 'Rounding',
      eligibility: 'Eligibility',
      behavior: 'Behavior',
      forgetScan: 'Forget Scan',

      behaviorFlags: 'Behavior Flags',
      flagValue: '{label}: {value}',

      allMethods: 'All Methods',
      roundMethodLabel: 'Round Method',
      minEligible: 'Min Eligible',
      roundUnit: 'Round Unit',
      graceAfterShiftEnd: 'Grace After Shift End',

      minEligibleShort: 'Min',
      graceShort: 'Grace',
      everyUnit: 'Every {unit}',

      codePlaceholder: 'Example: POST_SHIFT_STD_30M',
      namePlaceholder: 'Example: Post Shift Standard 30-Minute Ceiling',
      descriptionPlaceholder: 'Optional note for admins...',
      activeHelp: 'Active policies can be used by new Shift OT Options.',

      loading: 'Loading OT policies',
      noData: 'No OT policies matched your filters.',
      loadFailed: 'Failed to load OT policies.',
      saveFailed: 'Failed to save OT policy.',
      createdSuccess: 'OT policy created successfully.',
      updatedSuccess: 'OT policy updated successfully.',

      roundMethod: {
        floor: 'Floor',
        ceil: 'Ceil',
        nearest: 'Nearest',
      },

      flag: {
        allowPreShiftOT: 'Pre-shift',
        allowPostShiftOT: 'Post-shift',
        capByRequestedMinutes: 'Cap requested',
        treatForgetScanInAsPending: 'Missing clock-in pending',
        treatForgetScanOutAsPending: 'Missing clock-out pending',
        allowApprovedOtWithoutExactClockOut: 'No exact clock-out',
      },

      flagHelp: {
        allowPreShiftOT: 'Allow OT before shift start.',
        allowPostShiftOT: 'Allow OT after shift end.',
        capByRequestedMinutes: 'Do not pay more than requested OT.',
        treatForgetScanInAsPending: 'Require review when clock-in is missing.',
        treatForgetScanOutAsPending:
          'Require review when clock-out is missing.',
        allowApprovedOtWithoutExactClockOut:
          'Allow approved OT without exact clock-out when policy permits.',
      },

      short: {
        allowPreShiftOT: 'Pre',
        allowPostShiftOT: 'Post',
        capByRequestedMinutes: 'Cap',
        treatForgetScanInAsPending: 'FS In',
        treatForgetScanOutAsPending: 'FS Out',
        allowApprovedOtWithoutExactClockOut: 'No Exact Out',
      },

      flagShort: {
        pre: 'Pre {value}',
        post: 'Post {value}',
        cap: 'Cap {value}',
        noExactOut: 'No exact out {value}',
        fsIn: 'FS In {value}',
        fsOut: 'FS Out {value}',
      },

      validation: {
        codeRequired: 'Policy code is required.',
        codeTooLong: 'Policy code must not be longer than 50 characters.',
        nameRequired: 'Policy name is required.',
        nameTooLong: 'Policy name must not be longer than 150 characters.',
        descriptionTooLong:
          'Description must not be longer than 1000 characters.',
        roundMethodRequired: 'Round method is required.',
        roundMethodInvalid: 'Round method must be Floor, Ceil, or Nearest.',
        roundUnitInvalid: 'Round unit must be at least 1 minute.',
        roundUnitMinutesInvalid: 'Round unit must be at least 1 minute.',
        minEligibleInvalid: 'Minimum eligible minutes cannot be negative.',
        minEligibleMinutesInvalid:
          'Minimum eligible minutes cannot be negative.',
        graceInvalid: 'Grace minutes cannot be negative.',
        graceAfterShiftEndMinutesInvalid:
          'Grace after shift end minutes cannot be negative.',
        updatePayloadRequired: 'Please update at least one field.',
      },

      error: {
        codeExists: 'OT policy code already exists.',
        notFound: 'OT policy not found.',
        notFoundOrInactive: 'OT policy was not found or is inactive.',
        inactive: 'OT policy is inactive.',
      },
    },

    shiftOption: {
      tableTitle: 'Shift OT Options',
      subtitle:
        'Manage OT options by shift, day type, timing mode, and calculation policy.',
      searchPlaceholder: 'Search shift, option label, policy, or timing mode',

      newOption: 'New Option',
      createTitle: 'Create Shift OT Option',
      editTitle: 'Edit Shift OT Option',

      allShifts: 'All Shifts',
      allPolicies: 'All Policies',
      allTimingModes: 'All Timing Modes',
      allDayTypes: 'All Day Types',

      optionLabel: 'Option Label',
      dayType: 'Day Type',
      timingMode: 'Timing Mode',
      otWindow: 'OT Window',
      requested: 'Requested',
      break: 'Break',
      paid: 'Paid',
      policy: 'Calculation Policy',
      sequence: 'Sequence',

      selectShift: 'Select shift',
      selectPolicy: 'Select calculation policy',
      labelPlaceholder: 'Example: Evening OT 18:00 - 20:00',

      applicableDayTypes: 'Applicable Day Types',
      selectDayTypes: 'Select day types',
      startAfterShiftEnd: 'Start After Shift End',
      startAfterShiftEndHelp:
        'Backend uses the selected shift end time plus this offset to build the OT window.',
      requestedMinutes: 'Requested Minutes',
      fixedStartTime: 'Fixed Start Time',
      fixedEndTime: 'Fixed End Time',
      activeHelp: 'Inactive options will not be available for new OT requests.',

      timing: {
        afterShiftEnd: 'After Shift End',
        fixedTime: 'Fixed Time',
      },

      timingModeLabel: {
        afterShiftEnd: 'After Shift End',
        fixedTime: 'Fixed Time',
      },

      afterShiftOffset: 'Offset {offset} after shift end',
      roundEvery: 'Round every {unit}',
      minEligibleValue: 'Min {value}',

      noData: 'No shift OT options matched your filters.',
      loadFailed: 'Failed to load shift OT options.',
      saveFailed: 'Failed to save shift OT option.',
      createdSuccess: 'Shift OT option created successfully.',
      updatedSuccess: 'Shift OT option updated successfully.',
      shiftLookupFailed: 'Failed to load shift options.',
      policyLookupFailed: 'Failed to load policy options.',

      validation: {
        required: 'Please select OT option.',
        shiftRequired: 'Shift is required.',
        labelRequired: 'Option label is required.',
        labelTooLong: 'Option label must not be longer than 100 characters.',
        timingModeRequired: 'Timing mode is required.',
        timingModeInvalid: 'Timing mode is invalid.',
        dayTypeInvalid: 'Day type is invalid.',
        applicableDayTypesRequired:
          'Please select at least one applicable day type.',
        applicableDayTypesTooMany:
          'You can select up to 3 applicable day types only.',
        dayTypesRequired: 'Please select at least one applicable day type.',
        policyRequired: 'Calculation policy is required.',
        requestedMinutesInvalid: 'Requested minutes must be at least 1.',
        sequenceInvalid: 'Sequence must be at least 1.',
        startAfterShiftEndInvalid:
          'Start-after-shift-end minutes cannot be negative.',
        startAfterShiftEndMinutesInvalid:
          'Start-after-shift-end minutes cannot be negative.',
        fixedStartTimeInvalid: 'Fixed start time must use HH:mm format.',
        fixedEndTimeInvalid: 'Fixed end time must use HH:mm format.',
        fixedTimeSame: 'Fixed start time and end time cannot be the same.',
        fixedTimeRequired:
          'Selected fixed-time OT option must have fixed start and end time.',
        breakMinutesInvalid: 'Break minutes must be a non-negative integer.',
        breakMinutesTooLarge:
          'Break minutes cannot be greater than or equal to OT duration.',
        updatePayloadRequired: 'Please update at least one field.',
      },

      error: {
        notFound: 'Shift OT option not found.',
        duplicate: 'Duplicate active OT option for this shift.',
        labelExists: 'Active OT option label already exists for this shift.',
        sequenceExists:
          'Active OT option sequence already exists for this shift and day type.',
        dayTypeMismatch:
          'Selected OT option is not allowed for this OT date.',
        shiftMismatch:
          'Selected OT option does not belong to the employee assigned shift.',
      },
    },

    request: {
      validation: {
        otDateRequired: 'OT date is required.',
        employeeRequired: 'Please select at least 1 employee.',
        employeeIdsInvalid: 'Employee list is invalid.',
        employeeMaxExceeded: 'You can select up to 200 employees only.',
        employeeOverrideMaxExceeded:
          'You can set custom time for up to 200 employees only.',

        timingSourceInvalid: 'OT timing source is invalid.',
        shiftOtOptionRequired: 'Please select OT option.',

        customFixedTimeRequired:
          'Custom fixed OT start time and end time are required.',
        customStartTimeRequired: 'Custom start time is required.',
        customEndTimeRequired: 'Custom end time is required.',
        customTimeSame: 'Custom start time and end time cannot be the same.',

        breakMinutesInvalid: 'Break minutes must be a non-negative integer.',
        breakMinutesTooLarge:
          'Break minutes cannot be greater than or equal to OT duration.',

        reasonTooLong: 'Reason must not be longer than 2000 characters.',
        remarkTooLong: 'Remark must not be longer than 1000 characters.',

        overrideTimeSame:
          'Employee custom start time and end time cannot be the same.',
        overrideEmployeeNotSelected:
          'Custom time can only be set for selected employees.',
        overrideEmployeeDuplicate:
          'Duplicate employee in custom time override list.',

        statusInvalid: 'OT status is invalid.',
        dayTypeInvalid: 'OT day type is invalid.',
        approvalActionInvalid: 'Approval action is invalid.',
        rejectionReasonRequired: 'Please enter rejection reason.',
        requesterConfirmationActionInvalid:
          'Requester confirmation action is invalid.',
      },

      error: {
        notFound: 'OT request not found.',
        requesterEmployeeRequired: 'Requester employee profile is required.',
        approverNotFound: 'No OT approver found in the organization chart.',
        approverInactive: 'Approver is inactive.',
        employeeDuplicateDate:
          'Some employees already have OT request on this date.',
        todayAttendanceTimeInRequired:
          'Cannot create OT request for today because some employees do not have attendance time-in.',
        editNotAllowed: 'This OT request cannot be edited.',
        confirmNotAllowed:
          'Requester confirmation is not available for this OT request.',
        onlyPendingCanDecide: 'Only pending OT requests can be decided.',
        currentApprovalStepNotFound: 'Current approval step not found.',
        currentStepNotApprover:
          'Current workflow step is not an approver step.',
        notWaitingForYourApproval:
          'This OT request is not waiting for your approval.',
        noEmployeesToApprove: 'This OT request has no employee to approve.',
        noAdjustedEmployeeList:
          'There is no adjusted employee list to confirm.',
        employeeShiftRequired:
          'All selected employees must have an assigned shift.',
        employeeShiftMismatch:
          'All selected employees must belong to the same shift.',
      },
    },
  },

  payment: {
    title: 'Payment',
    processTitle: 'Payment Process',
    formulasTitle: 'Payment Formulas',
    preview: 'Preview',
    calculateExport: 'Calculate & Export',
    salaryTemplate: 'Salary Template',

    dayTypes: {
      workingDay: 'Working Day',
      sunday: 'Sunday',
      holiday: 'Holiday',
    },

    salary_file_required: 'Salary Excel file is required.',
    salary_file_invalid: 'Salary Excel file is empty or invalid.',

    attendance: {
      no_verification_result:
        'No attendance verification result found for this employee.',
    },

    formula: {
      invalid_id: 'Invalid payment formula ID.',
      not_found: 'Payment formula not found.',
      inactive: 'Payment formula is inactive.',
      code_required: 'Payment formula code is required.',
      code_already_exists: 'Payment formula code already exists.',
    },

    exchange_rate: {
      invalid_id: 'Invalid payment exchange rate ID.',
      not_found: 'Payment exchange rate not found.',
      inactive: 'Payment exchange rate is inactive.',
      currency_mismatch:
        'Payment formula currency does not match exchange rate source currency.',
      target_must_be_khr: 'Payment exchange rate target currency must be KHR.',
    },

    formulas: {
      tableTitle: 'Payment Formula List',
      searchPlaceholder: 'Search code, name, currency, or description',

      newFormula: 'New Formula',
      createTitle: 'Create Payment Formula',
      editTitle: 'Edit Payment Formula',

      formulaName: 'Formula Name',
      baseRule: 'Base Rule',
      multipliers: 'Multipliers',
      round: 'Round',
      currency: 'Currency',

      daysPerMonth: 'days / month',
      hoursPerDay: 'hours / day',
      hoursPerDayField: 'Hours / Day',
      decimals: 'decimals',

      workingDays: 'Working Days',
      roundDecimals: 'Round Decimals',
      dayTypeMultipliers: 'Day Type Multipliers',

      codePlaceholder: 'Example: STD_OT_2026',
      namePlaceholder: 'Example: Standard OT Formula 2026',
      descriptionPlaceholder: 'Optional formula description',

      dialogNote:
        'Formula setup is saved. Salary Excel and generated payment result are not saved.',
      previewTitle: 'Formula Preview',
      hourlyRatePreview:
        'Hourly Rate = Monthly Salary ÷ Working Days ÷ Hours Per Day',
      otAmountPreview:
        'OT Amount = Payable OT Hours × Hourly Rate × Day Type Multiplier',

      noData: 'No payment formulas matched your filters.',
      loadFailed: 'Failed to load payment formulas.',
      saveFailed: 'Failed to save payment formula.',
      createdSuccess: 'Payment formula created successfully.',
      updatedSuccess: 'Payment formula updated successfully.',

      validation: {
        codeRequired: 'Code is required.',
        codeTooLong: 'Code is too long.',
        nameRequired: 'Name is required.',
        nameTooLong: 'Name is too long.',
        descriptionTooLong: 'Description is too long.',
        monthlyWorkingDaysRequired: 'Monthly working days is required.',
        monthlyWorkingDaysInvalid:
          'Monthly working days must be greater than 0.',
        hoursPerDayRequired: 'Hours per day is required.',
        hoursPerDayInvalid: 'Hours per day must be greater than 0.',
        workingDayMultiplierInvalid:
          'Working day multiplier cannot be negative.',
        sundayMultiplierInvalid: 'Sunday multiplier cannot be negative.',
        holidayMultiplierInvalid: 'Holiday multiplier cannot be negative.',
        roundingInvalid: 'Round decimals must be between 0 and 6.',
        updatePayloadRequired: 'At least one field is required.',
      },

      error: {
        invalidId: 'Invalid payment formula ID.',
        notFound: 'Payment formula not found.',
        inactive: 'Payment formula is inactive.',
        codeRequired: 'Payment formula code is required.',
        codeAlreadyExists: 'Payment formula code already exists.',
      },
    },

    allowancePolicies: {
      tableTitle: 'Allowance Policy List',
      searchPlaceholder: 'Search code, name, description, type, currency, or apply rule',

      newPolicy: 'New Allowance Policy',
      createTitle: 'Create Allowance Policy',
      editTitle: 'Edit Allowance Policy',

      policyName: 'Policy Name',
      allowanceType: 'Allowance Type',
      allTypes: 'All Types',
      trigger: 'Trigger',
      threshold: 'Threshold',
      minOtMinutes: 'Minimum OT Minutes',
      amount: 'Amount',
      currency: 'Currency',
      applyPerLabel: 'Apply Per',

      codePlaceholder: 'Example: FOOD_ALLOWANCE_3H',
      namePlaceholder: 'Example: Food Allowance for OT 3 Hours Up',
      descriptionPlaceholder: 'Optional allowance policy description',

      dialogNote:
        'Allowance policies are used by Payment Process to add extra benefits automatically. Example: give food allowance when verified payable OT is 3 hours or more.',

      previewTitle: 'Rule Preview',
      otAtLeast: 'OT at least',

      noData: 'No allowance policies matched your filters.',
      loadFailed: 'Failed to load allowance policies.',
      saveFailed: 'Failed to save allowance policy.',
      createdSuccess: 'Allowance policy created successfully.',
      updatedSuccess: 'Allowance policy updated successfully.',

      types: {
        food: 'Food',
        transport: 'Transport',
        night: 'Night',
        holiday: 'Holiday',
        other: 'Other',
      },

      triggerTypes: {
        otMinutes: 'OT Minutes',
      },

      applyPer: {
        employeePerDay: 'Employee per day',
        employeePerRequest: 'Employee per request',
      },

      validation: {
        codeRequired: 'Code is required.',
        nameRequired: 'Name is required.',
        minOtMinutesRequired: 'Minimum OT minutes must be at least 1.',
        amountInvalid: 'Amount cannot be negative.',
        effectiveRangeInvalid:
          'Effective To must be greater than or equal to Effective From.',
      },

      error: {
        invalidId: 'Invalid allowance policy ID.',
        notFound: 'Allowance policy not found.',
        codeRequired: 'Allowance policy code is required.',
        codeExists: 'Allowance policy code already exists.',
      },
    },

    exchangeRates: {
      tableTitle: 'Payment Exchange Rates',
      newExchangeRate: 'New Rate',
      createTitle: 'Create Exchange Rate',
      editTitle: 'Edit Exchange Rate',

      searchPlaceholder: 'Search code, name, currency, or description',

      noData: 'No exchange rates found.',
      loadFailed: 'Unable to load payment exchange rates.',
      saveFailed: 'Unable to save payment exchange rate.',
      createdSuccess: 'Payment exchange rate created successfully.',
      updatedSuccess: 'Payment exchange rate updated successfully.',

      rateName: 'Rate Name',
      currencyPair: 'Currency Pair',
      rate: 'Rate',
      rounding: 'Rounding',
      mode: 'Mode',
      unit: 'Unit',
      fromCurrency: 'From Currency',
      toCurrency: 'To Currency',
      roundingUnit: 'Rounding Unit',
      roundingMode: 'Rounding Mode',
      denominations: 'Denominations',

      codePlaceholder: 'Example: KHR_4020',
      namePlaceholder: 'Example: USD to KHR 4020',
      descriptionPlaceholder: 'Optional note for this exchange rate',

      dialogNote:
        'Exchange rates are managed separately from payment formulas. Create any rate you need, then choose it during payment processing.',

      roundingPreviewTitle: 'Rounding behavior',
      roundRulePreview:
        'ROUND by 100 means 101–149 becomes 100 and 150–199 becomes 200.',
      cashBreakdownPreview:
        'Denominations are used to calculate cash paper breakdown from large to small.',

      roundingModes: {
        round: 'Round nearest',
        ceil: 'Round up',
        floor: 'Round down',
        none: 'No rounding',
      },

      validation: {
        codeRequired: 'Code is required.',
        codeTooLong: 'Code must not be longer than 50 characters.',
        nameRequired: 'Name is required.',
        nameTooLong: 'Name must not be longer than 150 characters.',
        descriptionTooLong:
          'Description must not be longer than 1000 characters.',
        fromCurrencyRequired: 'From currency is required.',
        toCurrencyRequired: 'To currency is required.',
        rateRequired: 'Rate is required.',
        ratePositive: 'Rate must be greater than 0.',
        roundingUnitPositive: 'Rounding unit must be greater than 0.',
        roundingModeInvalid: 'Rounding mode is invalid.',
        denominationsRequired: 'At least one denomination is required.',
        updatePayloadRequired: 'No update data provided.',
      },

      error: {
        invalidId: 'Invalid payment exchange rate ID.',
        notFound: 'Payment exchange rate not found.',
        inactive: 'Payment exchange rate is inactive.',
        codeRequired: 'Code is required.',
        codeExists: 'Exchange rate code already exists.',
      },
    },

    process: {
      field: {
        paymentFormula: 'Payment Formula',
        exchangeRate: 'Exchange Rate',
        noExchangeRate: 'No exchange rate selected',
        salaryExcel: 'Salary Excel',
        noFile: 'No file selected',
        formula: 'Formula',
        workingDays: 'Working Days',
        hoursPerDay: 'Hours Per Day',
        month: 'month',
        hours: 'hours',
        multipliers: 'Multipliers',
        calculation: 'Calculation',
      },
      warning: {
        invalidSalaryRow: 'Invalid salary row',
        duplicateSalaryRow: 'Duplicate salary row',
        noPayableMinutes: 'No payable minutes',
      },

      action: {
        uploadSalary: 'Upload Salary',
        changeFile: 'Change File',
        template: 'Template',
        preview: 'Preview',
        generate: 'Generate',
        loadMore: 'Load More',
      },

      card: {
        processingTitle: 'Payment Processing',
        formulaTitle: 'Formula Preview',
      },

      status: {
        previewReady: 'Preview Ready',
        notPreviewed: 'Not Previewed',
        ready: 'Ready',
      },

      note: {
        notSaved:
          'Salary file, preview result, and final payment file are not saved. If download fails, upload salary again and generate again.',
      },

      calendar: {
        title: 'Internal Calendar Check',
        loading: 'Loading Calendar',
        holidayCount: '{count} holiday(s)',
        workingDays: 'Working Days',
        sundays: 'Sundays',
        internalHolidays: 'Internal Holidays',
      },

      preview: {
        title: 'Payment Preview',
      },

      summary: {
        payableEmployees: 'Payable Employees',
        totalOtHours: 'Total OT Hours',
        totalAmount: 'Total Amount',
        totalUsd: 'Total USD',
        totalKhr: 'Total KHR',
        missingSalary: 'Missing Salary',
        warnings: 'Warnings',
        totalOtKhr: 'OT KHR',
        totalAllowanceKhr: 'Allowance KHR',
        totalPayableKhr: 'Total Payable KHR',
      },

      table: {
        setup: 'Payment Setup',
        detail: 'Payment Detail',
        missingSalary: 'Missing Salary',
        warnings: 'Warnings',
      },

      column: {
        type: 'Type',
        row: 'Row',

        requestNo: 'Request No',
        otOption: 'OT Option',
        otTime: 'OT Time',
        paymentDayType: 'Day Type',

        employeeId: 'Employee ID',
        employeeName: 'Employee Name',

        requested: 'Requested',
        break: 'Break',
        payable: 'Payable',
        otHours: 'OT Hours',

        salary: 'Salary',
        hourlyRate: 'Hourly Rate',
        multiplier: 'Multiplier',
        amount: 'Amount',
        amountUsd: 'Amount USD',

        exchangeRate: 'Rate',
        rawKhr: 'Raw KHR',
        roundedKhr: 'Rounded KHR',
        roundDiffKhr: 'Round Diff',

        salaryFound: 'Salary Found',
        currency: 'Currency',
        decision: 'Decision',
        reason: 'Reason',
        allowanceKhr: 'Allowance KHR',
        totalPayableKhr: 'Total Payable KHR',
      },

      label: {
        cappedByRequestPaid: 'Capped by request paid',
        backendCalculated: 'Backend calculated',
      },

      empty: {
        noFormula: 'No formula selected',
        selectFormula: 'Select an active payment formula before preview.',
        selectFormulaFirst: 'Choose formula first',
        noPaymentDetail: 'No payable payment detail found.',
        noMissingSalary: 'No missing salary.',
        noWarnings: 'No warnings.',
        previewTitle: 'No payment preview yet',
        previewHint:
          'Upload salary Excel and click Preview to see the payment result before download.',
      },

      validation: {
        fromDateRequired: 'From date is required.',
        toDateRequired: 'To date is required.',
        formulaRequired: 'Payment formula is required.',
        exchangeRateRequired: 'Exchange rate is required.',
        salaryRequired: 'Salary Excel file is required.',
        invalidDateRange: 'From date cannot be after To date.',
        dateYmd: 'Date must be in YYYY-MM-DD format.',
        invalidFormulaId: 'Invalid payment formula ID.',
        invalidExchangeRateId: 'Invalid payment exchange rate ID.',
        toDateAfterFrom:
          'To date must be greater than or equal to from date.',
      },

      message: {
        loadFormulasFailed: 'Failed to load payment formulas.',
        loadExchangeRatesFailed: 'Failed to load payment exchange rates.',

        calendarFailedTitle: 'Calendar failed',
        calendarFailed: 'Failed to load internal holiday calendar.',

        invalidFileTitle: 'Invalid file',
        invalidFile: 'Please upload Excel file only: .xlsx or .xls.',

        downloadedTitle: 'Downloaded',
        downloadFailedTitle: 'Download failed',
        templateDownloaded: 'Salary template downloaded.',
        templateDownloadFailed: 'Failed to download salary template.',

        checkFormTitle: 'Check form',

        previewReadyTitle: 'Preview ready',
        previewReady: 'Payment preview calculated successfully.',
        previewFailedTitle: 'Preview failed',
        previewFailed: 'Failed to calculate payment preview.',

        previewRequiredTitle: 'Preview required',
        previewRequired:
          'Please preview the payment before generating Excel.',

        generatedTitle: 'Generated',
        generated: 'Payment Excel generated successfully.',
        generateFailedTitle: 'Generate failed',
        generateFailed: 'Failed to generate payment Excel.',
      },

      salary: {
        fileRequired: 'Salary Excel file is required.',
        fileInvalid: 'Salary Excel file is empty or invalid.',
        unableToRead: 'Unable to read salary Excel file.',
        noSheet: 'Salary Excel has no sheet.',
        missingEmployeeId: 'Missing Employee ID.',
        invalidSalary: 'Invalid salary.',
        duplicateEmployeeId: 'Duplicate employee ID in salary Excel.',
        salaryNotFound: 'Salary not found in uploaded salary Excel.',
      },

      issue: {
        invalidSalaryRow: 'Invalid Salary Row',
        duplicateSalaryRow: 'Duplicate Salary Row',
        missingSalary: 'Missing Salary',
        noPayableMinutes: 'No Attendance/Policy Payable Minutes',
        attendanceVerificationNotSaved: 'Attendance Verification Not Saved',
        noAttendancePolicyPayable:
          'No attendance/policy payable minutes found.',
        payableWarning:
          'Payable minutes were calculated, but verification result is not exact MATCH.',
      },
    },
  },
  notification: {
    title: 'Notifications',
    subtitle: 'Latest system updates',
    emptyTitle: 'No notifications',
    emptyText: 'You are all caught up.',
    markAllRead: 'Mark all read',
    type: {
      otApprovalRequired: 'Approval Required',
      otApproved: 'Approved',
      otRejected: 'Rejected',
      otRequesterConfirmationRequired: 'Confirmation Required',
      otRequesterConfirmed: 'Requester Confirmed',
      otRequesterDisagreed: 'Requester Disagreed',
    },
    error: {
      notFound: 'Notification not found',
    },
    validation: {
      idRequired: 'Notification ID is required',
    },
  },
}