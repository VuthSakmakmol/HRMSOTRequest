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
    create: 'Create',
    edit: 'Edit',
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
    actions: 'Actions',

    status: 'Status',
    allStatus: 'All Status',
    active: 'Active',
    inactive: 'Inactive',
    yes: 'Yes',
    no: 'No',
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
    created: 'Created',
    updated: 'Updated',
    loadingData: 'Loading data',
    fetchingRecords: 'Fetching records from the server.',

    unknown: 'Unknown',
    refresh: 'Refresh',
    loadFailed: 'Load failed',
    active: 'Active',
    inactive: 'Inactive',
    search: 'Search',
      search: 'Search',
  fromDate: 'From Date',
  toDate: 'To Date',
  status: 'Status',
  allStatus: 'All Status',
  active: 'Active',
  inactive: 'Inactive',
  clear: 'Clear',
  import: 'Import',
  cancel: 'Cancel',
  save: 'Save',
  edit: 'Edit',
  actions: 'Actions',
  date: 'Date',
  code: 'Code',
  name: 'Name',
  description: 'Description',
  createdAt: 'Created At',
  noData: 'No Data',
  loadFailed: 'Load Failed',
  createFailed: 'Create Failed',
  updateFailed: 'Update Failed',
  created: 'Created',
  updated: 'Updated',
  updating: 'Updating',
  loading: 'Loading...',
  loadingData: 'Loading data',
  fetchingRecords: 'Fetching records...',
  loaded: 'Loaded {loaded} of {total}',
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

  org: {
    department: {
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
      // Table / filter
      tableTitle: 'Position List',
      searchPlaceholder: 'Search code, name, or description',

      department: 'Department',
      allDepartments: 'All Departments',

      hierarchyScope: 'Hierarchy Scope',
      allScopes: 'All Scopes',
      selectHierarchyScope: 'Select hierarchy scope',
      scopeSameLine: 'Same Line',
      scopeGlobal: 'Global',
      scopeCrossDepartment: 'Cross Department',

      // Actions
      newPosition: 'New Position',
      importExcel: 'Import Excel',
      exportExcel: 'Export Excel',

      // Create / edit form
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

      // Export
      exported: 'Exported',
      exportedSuccess: 'Position Excel exported successfully.',
      exportFailed: 'Export failed',

      // Import
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

      // Empty / error / success
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
      // Table / filter
      tableTitle: 'Employee List',
      searchPlaceholder: 'Search employee code, name, phone, email, or role',

      allDepartments: 'All Departments',
      allPositions: 'All Positions',
      allLines: 'All Lines',
      allShifts: 'All Shifts',

      // Actions
      newEmployee: 'New Employee',
      importExcel: 'Import Excel',
      exportExcel: 'Export Excel',

      // Create / edit form
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

      // Account
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

      // Export
      exported: 'Exported',
      exportedSuccess: 'Employee Excel exported successfully.',
      exportFailed: 'Export failed',

      // Import
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

      // Import error titles
      invalidExcelData: 'Invalid Excel data',
      importApiNotFound: 'Import API not found',
      duplicateData: 'Duplicate data',
      serverError: 'Server error',

      // Import friendly error details
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

      // Empty / error / success
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
    },

    line: {
      // Table / filter
      tableTitle: 'Production Line List',
      searchPlaceholder: 'Search code, name, or description',

      department: 'Department',
      allDepartments: 'All Departments',

      lineCode: 'Line Code',
      lineName: 'Line Name',
      allowedPositions: 'Allowed Positions',
      allPositionsInDepartment: 'All positions in department',

      // Actions
      newLine: 'New Line',
      importExcel: 'Import Excel',
      exportExcel: 'Export Excel',

      // Create / edit form
      createTitle: 'Create Production Line',
      editTitle: 'Edit Production Line',
      selectDepartment: 'Select department',
      selectAllowedPositions: 'Optional: select allowed positions',
      codeExample: 'Example: LINE-01',
      nameExample: 'Example: Sewing Line 01',
      descriptionPlaceholder: 'Optional production line description',

      // Export
      exported: 'Exported',
      exportedSuccess: 'Production lines exported successfully.',
      exportFailed: 'Failed to export production lines.',

      // Import
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

      // Empty / error / success
      noData: 'No production lines matched your filters.',
      loadFailed: 'Failed to load production lines.',
      departmentLoadFailed: 'Failed to load departments.',
      positionLoadFailed: 'Failed to load positions.',
      saveFailed: 'Failed to save production line.',
      createdSuccess: 'Production line created successfully.',
      updatedSuccess: 'Production line updated successfully.',
    },

    orgChart: {
      // Filter
      searchPlaceholder: 'Search employee code or name',
      rootPerson: 'Root Person',
      selectRootPerson: 'Select root person',
      includeInactive: 'Include inactive',

      // Chart
      treeTitle: 'Organization Chart',
      zoomLabel: 'Zoom: {zoom}',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
      resetZoom: 'Reset',

      // Node
      noEmployeeCode: 'No ID',
      noPosition: 'No Position',
      noDepartment: 'No Department',

      // Empty / error
      noTreeData: 'No organization chart data found.',
      loadFailed: 'Failed to load organization chart.',

      // Node action
      expandNode: 'Expand node',
      collapseNode: 'Collapse node',
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

    calendar: 'Calendar',

    shift: 'Shift',
    shiftMaster: 'Shift Master',

    accessControl: 'Access Control',
    accounts: 'Accounts',

    attendance: 'Attendance',
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
  },

  access: {
    permission: {
      tableTitle: 'Permission List',
      searchPlaceholder: 'Search permission code, name, module, or description',
      module: 'Module',
      allModules: 'All Modules',

      loading: 'Loading permissions...',
      noData: 'No permissions matched your filters.',
      loadFailed: 'Failed to load permissions.',
    },

    role: {
      // Table / filter
      tableTitle: 'Role List',
      searchPlaceholder: 'Search role code or display name',

      // Actions
      newRole: 'New Role',
      expandAll: 'Expand All',
      collapseAll: 'Collapse All',

      // Form
      createTitle: 'Create Role',
      editTitle: 'Edit Role',
      roleCode: 'Role Code',
      roleCodeExample: 'Example: SYSTEM_ADMIN',
      displayName: 'Display Name',
      displayNameExample: 'Example: System Admin',

      // Permissions
      permissionsByModule: 'Permissions by Module',
      fullPermissions: 'Full Permissions',
      count: 'Count',
      selectedCount: '{count} selected',
      moduleSelectedCount: '{selected} of {total} selected',
      morePermissions: '+{count} more',

      // Empty / error / success
      noData: 'No roles matched your filters.',
      loadFailed: 'Failed to load roles.',
      saveFailed: 'Failed to save role.',
      createdSuccess: 'Role created successfully.',
      updatedSuccess: 'Role updated successfully.',
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
      // Page / preview
      tableTitle: 'Holiday Calendar',
      previewTitle: 'Calendar Preview',
      previewCount: 'Holidays',
      activeHolidays: 'active holiday(s)',
      selectedDate: 'Selected Date',

      // Filters
      searchPlaceholder: 'Search code, name, or description',
      noData: 'No holidays found.',
      loadFailed: 'Failed to load holidays.',

      // Actions
      importExcel: 'Import Excel',
      exportExcel: 'Export Excel',
      newHoliday: 'New Holiday',
      createTitle: 'Create Holiday',
      editTitle: 'Edit Holiday',
      createOnSelectedDate: 'Create',
      editHoliday: 'Edit',

      // Form
      selectHolidayDate: 'Select holiday date',
      holidayCode: 'Holiday Code',
      codeExample: 'Example: KHNY',
      holidayName: 'Holiday Name',
      nameExample: 'Example: Khmer New Year',
      descriptionPlaceholder: 'Optional note or description',
      selectedDayType: 'Selected day type',

      // Status / fields
      paidHoliday: 'Paid Holiday',
      paidHolidayHelp: 'Use this when the holiday is paid.',
      activeHelp: 'Inactive holidays will not be used for day-type classification.',
      paid: 'Paid',
      unpaid: 'Unpaid',
      noCode: 'No Code',

      // Save messages
      createdSuccess: 'Holiday created successfully.',
      updatedSuccess: 'Holiday updated successfully.',
      saveFailed: 'Failed to save holiday.',

      // Export
      exported: 'Exported',
      exportedSuccess: 'Holiday Excel exported successfully.',
      exportFailed: 'Failed to export holidays.',

      // Import dialog
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
      importNote: 'Existing holidays with the same date or code may be updated depending on backend import rules.',

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
    requests: {
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
      dayType: 'Day Type',
      employee: 'Employee',
      employees: 'Employees',
      approver: 'Approver',
      requestedMinutes: 'Requested Minutes',
      paidMinutes: 'Paid Minutes',
      breakMinutes: 'Break Minutes',
    },
  },

  payment: {
    title: 'Payment',
    processTitle: 'Payment Process',
    formulasTitle: 'Payment Formulas',
    preview: 'Preview',
    calculateExport: 'Calculate & Export',
    salaryTemplate: 'Salary Template',
  },
}