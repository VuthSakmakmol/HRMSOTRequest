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

    no: 'No.',
    status: 'Status',
    allStatus: 'All Status',
    active: 'Active',
    inactive: 'Inactive',
    yes: 'Yes',
    none: 'None',
    unknown: 'Unknown',
    warning: 'Warning',

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
    downloaded: 'Downloaded',
    loadingData: 'Loading data',
    fetchingRecords: 'Fetching records from the server.',

    openNavigation: 'Open navigation',
    toggleDesktopSidebar: 'Toggle desktop sidebar',
    toggleTheme: 'Toggle theme',
    switchToLightMode: 'Switch to Light Mode',
    switchToDarkMode: 'Switch to Dark Mode',
    notifications: 'Notifications',
    language: 'Language',
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

    error: {
      loginFailed: 'Login failed. Please try again.',
    },

    account: {
      tableTitle: 'Account List',
      tableSubtitle: 'Server-side account list with lazy loading.',
      newAccount: 'New Account',
      searchPlaceholder: 'Search login ID, display name, employee, role, or permission',
      noData: 'No accounts matched your filters.',
      loadFailed: 'Failed to load accounts.',

      displayName: 'Display Name',
      directPermissions: 'Direct Permissions',
      mustChangePassword: 'Must Change Password',
      reset: 'Reset',

      createTitle: 'Create Account',
      editTitle: 'Edit Account',
      resetPassword: 'Reset Password',
      newPassword: 'New Password',
      forcePasswordChange: 'Force password change after reset',
      resettingFor: 'Resetting password for',

      selectEmployee: 'Select employee',
      selectRoles: 'Select roles',
      directPermissionHelp: 'Separate permission codes with commas.',
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
      passwordReset: 'Password reset',
      passwordResetSuccess: 'Password reset successfully.',
      resetFailed: 'Password reset failed.',
    },
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
    orgChart: 'Organization Chart',

    calendar: 'Calendar',
    holidayMaster: 'Holiday Master',

    shift: 'Shift',
    shiftMaster: 'Shift Master',

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
    permission: {
      tableTitle: 'Permission List',
      searchPlaceholder: 'Search',
      module: 'Module',
      allModules: 'All Modules',

      loading: 'Loading permissions...',
      noData: 'No permissions matched your filters.',
      loadFailed: 'Failed to load permissions.',
    },

    role: {
      tableTitle: 'Role List',
      searchPlaceholder: 'Search',

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
    },
  },

  org: {
    department: {
      importValidationFailed: 'Import validation failed',
      importErrorCount: '{count} error(s) found',
      importErrorListTitle: 'Fix these Excel rows before importing',
      importAllOrNothingNote:
        'All rows must be 100% valid. If any row has an error, nothing will be saved.',
      importRow: 'Row',
      importField: 'Field',
      importValue: 'Value',
      importReason: 'Reason',
      importUnknownError: 'Unknown import error',
      tableTitle: 'Department List',
      searchPlaceholder: 'Search code, name, or description',

      newDepartment: 'New Department',
      importExcel: 'Import Excel',
      exportExcel: 'Export Excel',

      createTitle: 'Create Department',
      editTitle: 'Edit Department',
      departmentCode: 'Department Code',
      departmentName: 'Department Name',
      codeExample: 'Example: HR',
      nameExample: 'Example: Human Resources',
      descriptionPlaceholder: 'Optional department description',

      exported: 'Exported',
      exportedSuccess: 'Department Excel exported successfully.',
      exportFailed: 'Export failed',

      imported: 'Imported',
      importedSuccess: 'Import completed. Created: {created}, Updated: {updated}.',
      importTitle: 'Import Department Excel',
      importGuideTitle: 'Import guide',
      importGuideStep1: 'Download the sample file.',
      importGuideStep2: 'Fill your department data in the same format.',
      importGuideStep3: 'Choose the completed Excel file from your computer.',
      importGuideStep4: 'Click Import to upload and process it.',
      downloadSample: 'Download Sample',
      downloadSampleFailed: 'Download sample failed',
      sampleDownloaded: 'Sample file downloaded successfully.',
      excelFile: 'Excel file',
      chooseFile: 'Choose File',
      noFileSelected: 'No file selected',
      importInvalidFileTitle: 'Invalid file type',
      importInvalidFileMessage: 'Please choose an Excel file only: .xlsx, .xls, or .csv.',
      importFailed: 'Import failed',

      noData: 'No departments matched your filters.',
      loadFailed: 'Failed to load departments.',
      saveFailed: 'Failed to save department.',
      createdSuccess: 'Department created successfully.',
      updatedSuccess: 'Department updated successfully.',
    },
    position: {
      tableTitle: 'Position List',
      searchPlaceholder: 'Search code, name, or description',

      importedSuccess: 'Import completed. Created: {created}, Updated: {updated}.',
      importValidationFailed: 'Import validation failed',
      importErrorCount: '{count} error(s) found',
      importErrorListTitle: 'Fix these Excel rows before importing',
      importAllOrNothingNote:
        'All rows must be 100% valid. If any row has an error, nothing will be saved.',
      importRow: 'Row',
      importField: 'Field',
      importValue: 'Value',
      importReason: 'Reason',
      importUnknownError: 'Unknown import error',
      department: 'Department',
      allDepartments: 'All Departments',
      importValidationFailed: 'Import validation failed',
      importErrorCount: '{count} error(s) found',
      importErrorListTitle: 'Fix these Excel rows before importing',
      importAllOrNothingNote:
        'All rows must be 100% valid. If any row has an error, nothing will be saved.',
      importRow: 'Row',
      importField: 'Field',
      importValue: 'Value',
      importReason: 'Reason',
      importUnknownError: 'Unknown import error',
      importUploading: 'Uploading file... {percent}%',
      importProcessing: 'File uploaded. Validating Excel rows and saving data...',

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
      codeExample: 'Example: SW',
      nameExample: 'Example: Sewer',
      selectDepartment: 'Select department',

      reportsToPosition: 'Reports To Position',
      selectReportsToPosition: 'Optional: select parent/supervisor position',
      reportsToHelp:
        'Example: Sewer reports to Sewer Supervisor. Cross-department reporting is allowed.',

      managerScope: 'Manager Scope',
      sameLine: 'Same Line',
      global: 'Global',
      managerScopeHelp:
        'Same Line = find manager in the same production line. Global = find manager by parent position across departments.',

      level: 'Level',
      activeHelp: 'Inactive positions will be hidden from normal employee assignment selectors.',
      descriptionPlaceholder: 'Optional position description',

      exported: 'Exported',
      exportedSuccess: 'Position Excel exported successfully.',
      exportFailed: 'Export failed',

      imported: 'Imported',
      importedSuccess:
        'Import completed. Created: {created}, Updated: {updated}, Failed: {failed}.',
      importTitle: 'Import Position Excel',
      importGuideTitle: 'Import guide',
      importGuideStep1: 'Download the sample file.',
      importGuideStep2: 'Fill your position data using readable codes only.',
      importGuideStep3: 'Department Code must already exist in Department master data.',
      importGuideStep4:
        'Reports To Position Code must already exist or be included in the same import file.',
      importGuideStep5: 'Click Import to upload and process it.',
      importNote:
        'Users never need Mongo IDs in Excel. Use readable codes such as Department Code and Position Code.',

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

      noData: 'No positions matched your filters.',
      loadFailed: 'Failed to load positions.',
      departmentLoadFailed: 'Failed to load departments.',
      departmentLookupFailed: 'Failed to load department options.',
      parentLoadFailed: 'Failed to load reports-to positions.',
      reportsToLookupFailed: 'Failed to load reports-to position options.',
      saveFailed: 'Failed to save position.',
      createdSuccess: 'Position created successfully.',
      updatedSuccess: 'Position updated successfully.',
    },
    employee: {
      tableTitle: 'Employee List',
      searchPlaceholder: 'Search employee code, name, phone, email, or role',

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

      accountDefaultNoAccount: 'Default: no login account will be created.',
      accountPreview: 'Login ID: {loginId} · Default Password: {password}',

      accountLoginIdPlaceholder: 'Default: employee code',
      defaultPassword: 'Default Password',
      defaultPasswordPlaceholder: 'Default: employee code + phone number',

      accountPhoneRequired:
        'Phone number is required when creating a login account because the default password uses Employee Code + Phone Number.',

      accountActive: 'Account Active',

      createdWithAccountSuccess: 'Employee and login account created successfully.',
      updatedWithAccountSuccess: 'Employee updated and login account created successfully.',

      exported: 'Exported',
      exportedSuccess: 'Employee Excel exported successfully.',
      exportFailed: 'Export failed',

      imported: 'Imported',
      importedSuccess: 'Import completed. Created: {created}, Updated: {updated}.',

      importTitle: 'Import Employee Excel',
      importGuideTitle: 'Import guide',
      importGuideStep1: 'Download the sample file.',
      importGuideStep2: 'Fill your employee data using readable codes only.',
      importGuideStep3: 'Join Date format must be DD/MM/YYYY, for example 30/04/2026.',
      importGuideStep4:
        'Department Code, Position Code, Line Code, and Shift Code must already exist in master data.',
      importGuideStep5:
        'Use Reports To Employee Code for manager/supervisor, then click Import.',

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
      importedSuccess: 'Import completed. Created: {created}, Updated: {updated}, Accounts created: {accountsCreated}.',
      importAllOrNothingNote:
  'All rows must be 100% valid. If any row has an error, nothing will be saved.',
    },
    line: {
      tableTitle: 'Production Line List',
      searchPlaceholder: 'Search code, name, or description',
      importValidationFailed: 'Import validation failed',
      importErrorCount: '{count} error(s) found',
      importErrorListTitle: 'Fix these Excel rows before importing',
      importAllOrNothingNote:
        'All rows must be 100% valid. If any row has an error, nothing will be saved.',
      importRow: 'Row',
      importValidationFailed: 'Import validation failed',
      importErrorCount: '{count} error(s) found',
      importErrorListTitle: 'Fix these Excel rows before importing',
      importAllOrNothingNote:
        'All rows must be 100% valid. If any row has an error, nothing will be saved.',
      importRow: 'Row',
      importField: 'Field',
      importValue: 'Value',
      importReason: 'Reason',
      importUnknownError: 'Unknown import error',
      importUploading: 'Uploading file... {percent}%',
      importProcessing: 'File uploaded. Validating Excel rows and saving employee data...',
      importField: 'Field',
      importValue: 'Value',
      importReason: 'Reason',
      importUnknownError: 'Unknown import error',
      importUploading: 'Uploading file... {percent}%',
      importProcessing: 'File uploaded. Validating Excel rows and saving data...',

      department: 'Department',
      allDepartments: 'All Departments',

      lineCode: 'Line Code',
      lineName: 'Line Name',
      allowedPositions: 'Allowed Positions',
      allPositionsInDepartment: 'All positions in department',

      newLine: 'New Line',
      importExcel: 'Import Excel',
      exportExcel: 'Export Excel',

      createTitle: 'Create Production Line',
      editTitle: 'Edit Production Line',
      selectDepartment: 'Select department',
      selectAllowedPositions: 'Optional: select allowed positions',
      codeExample: 'Example: LINE-01',
      nameExample: 'Example: Sewing Line 01',
      descriptionPlaceholder: 'Optional production line description',

      exported: 'Exported',
      exportedSuccess: 'Production lines exported successfully.',
      exportFailed: 'Failed to export production lines.',

      imported: 'Imported',
      importedSuccess: 'Import completed. Created: {created}, Updated: {updated}.',

      importTitle: 'Import Production Lines',
      importGuideTitle: 'Import guide',
      importGuideStep1: 'Download the sample file.',
      importGuideStep2: 'Fill your production line data using readable codes only.',
      importGuideStep3: 'Department Code must already exist in Department master data.',
      importGuideStep4: 'Use Position Codes only when the line allows specific positions.',

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

      noData: 'No production lines matched your filters.',
      loadFailed: 'Failed to load production lines.',
      departmentLoadFailed: 'Failed to load departments.',
      positionLoadFailed: 'Failed to load positions.',
      saveFailed: 'Failed to save production line.',
      createdSuccess: 'Production line created successfully.',
      updatedSuccess: 'Production line updated successfully.',
    },

    orgChart: {
      searchPlaceholder: 'Search employee code or name',
      rootPerson: 'Root Person',
      selectRootPerson: 'Select root person',
      includeInactive: 'Include inactive',

      treeTitle: 'Organization Chart',
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
      activeHelp: 'Inactive holidays will not be used for day-type classification.',
      paid: 'Paid',
      unpaid: 'Unpaid',
      noCode: 'No Code',

      createdSuccess: 'Holiday created successfully.',
      updatedSuccess: 'Holiday updated successfully.',
      saveFailed: 'Failed to save holiday.',

      exported: 'Exported',
      exportedSuccess: 'Holiday Excel exported successfully.',
      exportFailed: 'Failed to export holidays.',

      importTitle: 'Import Holidays',
      importInvalidFileTitle: 'Invalid file',
      importInvalidFileMessage: 'Please select an Excel or CSV file.',
      importFailed: 'Failed to import holidays.',
      imported: 'Imported',
      importedSuccess: 'Import completed. Created: {created}, Updated: {updated}.',

      importGuideTitle: 'Import guide',
      importGuideStep1: 'Download the sample file.',
      importGuideStep2: 'Fill in holiday date, code, name, paid holiday, and active status.',
      importGuideStep3: 'Use DD/MM/YYYY format for dates.',
      importGuideStep4: 'Upload the completed file.',
      importNote:
        'Existing holidays with the same date or code may be updated depending on backend import rules.',

      downloadSample: 'Download Sample',
      sampleDownloaded: 'Sample downloaded.',
      downloadSampleFailed: 'Failed to download sample.',

      excelFile: 'Excel File',
      noFileSelected: 'No file selected',
      chooseFile: 'Choose File',
    },
  },

  shift: {
    pageTitle: 'Shift Master',
    pageSubtitle: 'Manage working shifts, break time, cross-midnight rules, and Excel import/export.',
    tableTitle: 'Shift List',

    type: {
      day: 'Day',
      night: 'Night',
    },

    action: {
      importExcel: 'Import Excel',
      exportExcel: 'Export Excel',
      newShift: 'New Shift',
      createShift: 'Create Shift',
    },

    permission: {
      noView: 'You do not have permission to view shifts.',
    },

    filter: {
      searchPlaceholder: 'Search shift code or name',
      type: 'Type',
      status: 'Status',
      allTypes: 'All Types',
      allStatuses: 'All Status',
    },

    table: {
      loading: 'Loading shifts...',
      updating: 'Updating shifts...',
      empty: 'No shifts matched your filters.',
      loadedSummary: 'Loaded {loaded} of {total}',
    },

    column: {
      code: 'Code',
      name: 'Name',
      type: 'Type',
      start: 'Start',
      breakStart: 'Break Start',
      breakEnd: 'Break End',
      end: 'End',
      crossMidnight: 'Cross Night',
      working: 'Working',
      status: 'Status',
      createdAt: 'Created At',
      actions: 'Actions',
    },

    duration: {
      hours: '{hours}h',
      minutes: '{minutes}m',
      hoursMinutes: '{hours}h {minutes}m',
    },

    dialog: {
      createTitle: 'Create Shift',
      editTitle: 'Edit Shift',
    },

    form: {
      code: 'Shift Code',
      name: 'Shift Name',
      type: 'Shift Type',
      activeStatus: 'Active Status',
      startTime: 'Start Time',
      breakStartTime: 'Break Start',
      breakEndTime: 'Break End',
      endTime: 'End Time',
      codePlaceholder: 'Example: DAY-0700',
      namePlaceholder: 'Example: Day Shift 07:00 - 16:00',
      typePlaceholder: 'Select type',
      timeHint:
        'Use HH:mm format. DAY shift cannot cross midnight. NIGHT shift must cross midnight. Break time must be inside the shift time.',
    },

    import: {
      title: 'Import Shifts',
      guideTitle: 'Import guide',
      guideStep1: 'Download the sample file.',
      guideStep2: 'Fill your shift data using readable shift codes only.',
      guideStep3: 'Use HH:mm format for all time fields.',
      guideStep4: 'Use DAY for same-day shifts and NIGHT for cross-midnight shifts.',
      guideStep5: 'Choose the completed Excel file and click Import.',

      formatTitle: 'Excel import format',
      description:
        'Download the sample file, fill in shift records, then upload the completed Excel file.',
      ruleType: 'Type must be DAY or NIGHT.',
      ruleTime: 'Time fields must use HH:mm format.',
      ruleDay: 'DAY shift cannot cross midnight.',
      ruleNight: 'NIGHT shift must cross midnight.',

      fileLabel: 'Excel file',
      chooseFile: 'Choose File',
      noFileSelected: 'No file selected',
      selectedFile: 'Selected',
      downloadSample: 'Download Sample',
      sampleDownloaded: 'Sample file downloaded successfully.',
      import: 'Import',

      invalidExcelData: 'Invalid Excel data',
      importApiNotFound: 'Import API not found',
      duplicateData: 'Duplicate data',
      serverError: 'Server error',

      helpCodeRequired:
        'Shift Code is required because the system uses it as the human-readable shift key.',
      helpType: 'Type must be DAY or NIGHT.',
      helpStartTime: 'Start Time must use HH:mm format, for example 07:00.',
      helpBreakStartTime: 'Break Start must use HH:mm format, for example 12:00.',
      helpBreakEndTime: 'Break End must use HH:mm format, for example 13:00.',
      helpEndTime: 'End Time must use HH:mm format, for example 16:00.',
      helpCrossMidnight:
        'DAY shift must end after start time on the same day. NIGHT shift must cross midnight.',
      helpBreakInside: 'Break time must be inside the shift start and end time.',
      helpDuplicateCode: 'Use a unique Shift Code or update the existing shift record.',

      toast: {
        invalidFileTitle: 'Invalid file type',
        invalidFileDetail: 'Please choose an Excel file only: .xlsx, .xls, or .csv.',
        downloadFailedTitle: 'Download sample failed',
        downloadFailedDetail: 'Failed to download shift sample file.',
        importFailedTitle: 'Import failed',
        importFailedDetail: 'Failed to import shift Excel file.',
        importedTitle: 'Imported',
        importedDetail:
          'Import completed. Total: {total}, Created: {created}, Updated: {updated}.',
      },
    },

    toast: {
      loadFailedTitle: 'Load failed',
      loadFailedDetail: 'Failed to load shifts.',
      createdTitle: 'Created',
      createdDetail: 'Shift created successfully.',
      updatedTitle: 'Updated',
      updatedDetail: 'Shift updated successfully.',
      createFailedTitle: 'Create failed',
      saveFailedTitle: 'Save failed',
      saveFailedDetail: 'Failed to save shift.',
      exportedTitle: 'Exported',
      exportedDetail: 'Shift Excel exported successfully.',
      exportFailedTitle: 'Export failed',
      exportFailedDetail: 'Failed to export shifts.',
    },

    validation: {
      codeRequired: 'Shift code is required.',
      codeTooLong: 'Shift code is too long.',
      nameRequired: 'Shift name is required.',
      nameTooLong: 'Shift name is too long.',
      typeInvalid: 'Shift type must be DAY or NIGHT.',
      startTimeInvalid: 'Start time must use HH:mm format.',
      breakStartTimeInvalid: 'Break start time must use HH:mm format.',
      breakEndTimeInvalid: 'Break end time must use HH:mm format.',
      endTimeInvalid: 'End time must use HH:mm format.',
      isActiveInvalid: 'Status is invalid.',
      shiftIdInvalid: 'Shift ID is invalid.',
      updatePayloadRequired: 'Please update at least one field.',
    },

    error: {
      startEndSame: 'Shift start time and end time cannot be the same.',
      breakStartEndSame: 'Break start time and break end time cannot be the same.',
      dayCannotCrossMidnight: 'DAY shift cannot cross midnight.',
      nightMustCrossMidnight: 'NIGHT shift must cross midnight.',
      breakEndBeforeStart: 'Break end time must be later than break start time.',
      breakOutsideShift: 'Break time must be inside shift working time.',
      codeExists: 'Shift code already exists.',
      notFound: 'Shift not found.',
      excelFileRequired: 'Excel file is required.',
      excelNoRows: 'Excel file has no rows.',
    },

    importError: {
      invalidStatus: 'Invalid status in import file.',
      rowInvalid: 'Invalid row data.',
      duplicateShiftId: 'Duplicate Shift ID in import file.',
      duplicateCode: 'Duplicate shift code in import file.',
      shiftIdNotFound: 'Shift ID not found.',
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
      guideStep3: 'Fill Employee ID, Clock In, and Clock Out.',
      guideStep4: 'Choose the completed Excel file and click Import.',
      note: 'Attendance date is required. The backend will classify the day type from the holiday calendar.',

      downloadSample: 'Download Sample',
      sampleDownloaded: 'Sample file downloaded successfully.',
      downloadFailed: 'Download failed',

      importCompleted: 'Import completed',
      importCompletedSuccess: 'Attendance imported successfully.',
      importCompletedPartial: 'Attendance imported with some skipped or invalid rows.',
      importFailed: 'Import failed',

      validation: 'Validation',
      invalidFile: 'Invalid file',
      invalidExcelData: 'Invalid Excel data',
      importApiNotFound: 'Import API not found',
      duplicateData: 'Duplicate data',
      serverError: 'Server error',

      chooseExcelFile: 'Please choose an Excel file.',
      invalidExcelFile: 'Please upload Excel file only: .xlsx, .xls, or .csv.',
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
      latestImportDescription: 'Latest uploaded file has been processed by the backend import engine.',
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

      searchImportPlaceholder: 'Search import no, file name, remark',
      searchRecordsPlaceholder: 'Search employee, imported name, reason',
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
      missingImportIdDetail: 'Cannot open this import detail because ID is missing.',
      noDataFound: 'No data found',
      updating: 'Updating',
      failedRowsWarning: 'Some rows failed or were skipped. Review the failed row list below.',
      partialImportWarning: 'Attendance was imported with some skipped, duplicated, or invalid rows.',
    },

    verification: {
      otDate: 'OT Date',
      selectOtDate: 'Select OT date',
      searchOtRequest: 'Search OT Request',
      selectOtRequest: 'Select OT request',
      requestStatus: 'Request Status',

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
      searchPlaceholder: 'Search employee/result/reason',
      result: 'Result',
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
      emptyInstruction: 'Select an OT date, choose an OT request, then verify attendance result.',

      otDateRequired: 'OT date required',
      otDateRequiredDetail: 'Please select OT date first.',
      noOtRequests: 'No OT requests',
      noOtRequestsDetail: 'No OT request found for the selected date and status.',
      loadFailed: 'Load failed',
      loadVerificationFailed: 'Failed to load OT attendance verification.',
      loadRequestsFailed: 'Failed to load OT requests.',

      noRequestNo: 'No Request No',
      statusPrefix: 'Status',
      staff: 'staff',

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
      tableTitle: 'OT Request List',
      title: 'OT Requests',
      createTitle: 'Create OT Request',
      editTitle: 'Edit OT Request',
      detailTitle: 'OT Request Detail',
      approvalTitle: 'OT Approval Inbox',
      acknowledgeTitle: 'OT Acknowledge Inbox',
      subtitle: 'Manage overtime requests using backend-driven data.',

      requestNo: 'Request No.',
      otDate: 'OT Date',
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
      exportExcel: 'Export Excel',
      newRequest: 'New OT Request',

      allDayTypes: 'All Day Types',
      otDateFrom: 'OT Date From',
      otDateTo: 'OT Date To',

      loading: 'Loading OT requests',
      fetchingRecords: 'Fetching OT request records...',
      noData: 'No OT requests found.',
      loadFailed: 'Failed to load OT requests.',

      exported: 'Export ready',
      exportedSuccess: 'Excel file downloaded successfully.',
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
      break: 'Break',
      total: 'Total',
      mode: 'Mode',
      noEmployeeData: 'No employee data found for this request.',

      edit: {
        title: 'Edit OT Request',
        subtitle: 'Requester can edit only before any approval step becomes approved.',
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
        otOptionPolicy: '4. OT Option / Policy',
        selectTimingType: 'Select timing type',
        selectOtOption: 'Select OT option',

        customDefaultTime: 'Custom default OT time',
        customDefaultTimeHelp: 'All selected employees use this time unless adjusted later.',
        flexible: 'Flexible',

        startTime: 'Start Time',
        endTime: 'End Time',
        breakMinutes: 'Break Minutes',

        timing: 'Timing',
        start: 'Start',
        end: 'End',
        total: 'Total',
        submitRequest: 'Submit OT Request',

        reason: '5. Reason',
        optional: 'Optional',
        reasonPlaceholder: 'Example: urgent production order, shipment deadline...',

        validationTitle: 'Check form',
        waitAvailability: 'Please wait until OT availability check finishes.',
        selectDateFirst: 'Please select OT date first.',
        selectAtLeastOneEmployee: 'Please select at least 1 employee.',
        missingShift: 'Some selected employees do not have assigned shift information.',
        mixedShift: 'Please select employees from one shift only before creating OT request.',
        selectOtOptionForDayType: 'Please select OT option for {dayType}.',
        selectOtOptionRequired: 'Please select OT option.',
        enterCustomStartTime: 'Please enter custom start time.',
        enterCustomEndTime: 'Please enter custom end time.',
        customStartInvalid: 'Custom start time must be HH:mm, for example 18:00.',
        customEndInvalid: 'Custom end time must be HH:mm, for example 20:00.',
        customTimeInvalid: 'Custom start and end time must be HH:mm.',
        customTimeSame: 'Custom start time and end time cannot be the same.',
        breakTooLong: 'Break minutes cannot be greater than or equal to OT duration.',
        selectValidTiming: 'Please select valid OT timing before submitting.',

        missingEmployeeStart: 'Missing OT start time for {employee}.',
        missingEmployeeEnd: 'Missing OT end time for {employee}.',
        employeeStartInvalid: 'Invalid OT start time for {employee}.',
        employeeEndInvalid: 'Invalid OT end time for {employee}.',
        employeeTimeSame: 'OT start time and end time cannot be the same for {employee}.',
        employeeBreakTooLong:
          'Break minutes cannot be greater than or equal to OT duration for {employee}.',

        profileLoadFailed: 'Profile load failed',
        profileLoadFailedDetail: 'Unable to load your employee profile.',

        availabilityFailed: 'OT availability check failed',
        availabilityFailedDetail: 'Unable to check existing OT employees for this date.',

        optionsFailed: 'OT options failed',
        optionsFailedDetail: 'Unable to load OT options for the selected shift and date.',

        noOptionTitle: 'No OT option',
        noOptionForDayType: 'No active OT option found for {dayType}. Please ask admin to create one.',
        noOptionGeneric: 'No active OT option found for this shift/date.',

        calendarUnavailableTitle: 'Holiday calendar unavailable',
        calendarUnavailableDetail: 'Unable to load internal holiday calendar.',

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
        todayAttendanceRequired: 'Today OT requires attendance time-in before creating the request.',
        missingClockInDetail:
          'Today OT requires attendance time-in. Removed from selection: {preview}.',
        missingClockInDetailMore:
          'Today OT requires attendance time-in. Removed from selection: {preview}, and {more} more.',

        accountEmployeeLinkRequired:
          'Your login account is not linked to an employee profile. Please check Account and Employee setup.',
        approverNotFound:
          'No OT approver found in the organization chart. Please set manager chain and OT Role = Approver.',
        duplicateEmployeeDate: 'Some employees already have OT request on this date.',

        timingMode: {
          customFixed: 'Custom Fixed Time',
          fixedTime: 'Fixed Time',
          afterShiftEnd: 'After Shift End',
        },

        employeePicker: {
          title: '2. Choose employees',
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
          checkingBlocked: 'Checking employees already used in OT on this date...',
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
          scrollMoreLocal: 'Scroll inside this line to show more employees...',
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
          shiftMismatch: 'Employee shift does not match selected shift.',
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
        treatForgetScanOutAsPending: 'Require review when clock-out is missing.',
        allowApprovedOtWithoutExactClockOut:
          'Allow approved OT without exact clock-out when policy permits.',
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
        codeRequired: 'Code is required.',
        nameRequired: 'Name is required.',
        roundMethodRequired: 'Round method is required.',
        roundUnitInvalid: 'Round unit must be at least 1 minute.',
        minEligibleInvalid: 'Minimum eligible minutes cannot be negative.',
        graceInvalid: 'Grace minutes cannot be negative.',
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
        shiftRequired: 'Shift is required.',
        labelRequired: 'Option label is required.',
        timingModeRequired: 'Timing mode is required.',
        dayTypesRequired: 'Please select at least one applicable day type.',
        policyRequired: 'Calculation policy is required.',
        requestedMinutesInvalid: 'Requested minutes must be at least 1.',
        sequenceInvalid: 'Sequence must be at least 1.',
        startAfterShiftEndInvalid: 'Start-after-shift-end minutes cannot be negative.',
        fixedStartTimeInvalid: 'Fixed start time must use HH:mm format.',
        fixedEndTimeInvalid: 'Fixed end time must use HH:mm format.',
        fixedTimeSame: 'Fixed start time and end time cannot be the same.',
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

    formulas: {
      tableTitle: 'Payment Formula List',
      searchPlaceholder: 'Search code, name, or description',

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
      descriptionPlaceholder: 'Optional description...',

      dialogNote:
        'Formula setup is saved. Salary Excel and generated payment result are not saved.',

      hourlyRatePreview:
        'Hourly Rate',
      otAmountPreview:
        'OT Amount = Payable OT Hours × Hourly Rate × Day Type Multiplier',

      noData: 'No payment formulas matched your filters.',
      loadFailed: 'Failed to load payment formulas.',
      saveFailed: 'Failed to save payment formula.',
      createdSuccess: 'Payment formula created successfully.',
      updatedSuccess: 'Payment formula updated successfully.',

      validation: {
        codeRequired: 'Code is required.',
        nameRequired: 'Name is required.',
        workingDaysRequired: 'Monthly working days must be greater than 0.',
        hoursPerDayRequired: 'Hours per day must be greater than 0.',
        workingDayMultiplierInvalid: 'Working day multiplier cannot be negative.',
        sundayMultiplierInvalid: 'Sunday multiplier cannot be negative.',
        holidayMultiplierInvalid: 'Holiday multiplier cannot be negative.',
        roundingInvalid: 'Round decimals must be between 0 and 6.',
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

      action: {
        uploadSalary: 'Upload Salary',
        changeFile: 'Change File',
        template: 'Template',
        preview: 'Preview',
        generate: 'Generate',
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
      },

      table: {
        setup: 'Payment setup',
        detail: 'Payment Detail',
        missingSalary: 'Missing Salary',
        warnings: 'Warnings',
      },

      column: {
        requestNo: 'Request No',
        otOption: 'OT Option',
        otTime: 'OT Time',
        paymentDayType: 'Day Type',
        employeeId: 'Employee ID',
        employeeName: 'Employee Name',
        requested: 'Requested',
        break: 'Break',
        payable: 'Payable',
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
        otHours: 'OT Hours',
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
        previewRequired: 'Please preview the payment before generating Excel.',

        generatedTitle: 'Generated',
        generated: 'Payment Excel generated successfully.',
        generateFailedTitle: 'Generate failed',
        generateFailed: 'Failed to generate payment Excel.',
      },
    },
    exchangeRates: {
      tableTitle: 'Payment exchange rates',
      newExchangeRate: 'New rate',
      createTitle: 'Create exchange rate',
      editTitle: 'Edit exchange rate',
      searchPlaceholder: 'Search code, name, currency, or description...',
      noData: 'No exchange rates found.',
      loadFailed: 'Unable to load payment exchange rates.',
      saveFailed: 'Unable to save payment exchange rate.',
      createdSuccess: 'Payment exchange rate created successfully.',
      updatedSuccess: 'Payment exchange rate updated successfully.',

      rateName: 'Rate name',
      currencyPair: 'Currency pair',
      rate: 'Rate',
      rounding: 'Rounding',
      mode: 'Mode',
      unit: 'Unit',
      fromCurrency: 'From currency',
      toCurrency: 'To currency',
      roundingUnit: 'Rounding unit',
      roundingMode: 'Rounding mode',
      denominations: 'Denominations',

      codePlaceholder: 'Example: KHR_4020',
      namePlaceholder: 'Example: USD to KHR 4020',
      descriptionPlaceholder: 'Optional note for this exchange rate',
      dialogNote: 'Exchange rates are managed separately from payment formulas. Create any rate you need, then choose it during payment processing.',

      roundingPreviewTitle: 'Rounding behavior',
      roundRulePreview: 'ROUND by 100 means 101–149 becomes 100 and 150–199 becomes 200.',
      cashBreakdownPreview: 'Denominations are used to calculate cash paper breakdown from large to small.',

      roundingModes: {
        round: 'Round nearest',
        ceil: 'Round up',
        floor: 'Round down',
        none: 'No rounding',
      },
    },
  },
  
}