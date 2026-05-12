// frontend/src/shared/i18n/messages/kh.js

export default {
  common: {
    appName: 'សំណើ OT',

    loading: 'កំពុងផ្ទុក',
    updating: 'កំពុងធ្វើបច្ចុប្បន្នភាព',
    search: 'ស្វែងរក',
    refresh: 'ធ្វើឱ្យថ្មី',
    clear: 'សម្អាត',
    selectAll: 'ជ្រើសទាំងអស់',
    export: 'នាំចេញ',
    import: 'នាំចូល',
    download: 'ទាញយក',
    create: 'បង្កើត',
    edit: 'កែប្រែ',
    update: 'ធ្វើបច្ចុប្បន្នភាព',
    delete: 'លុប',
    save: 'រក្សាទុក',
    cancel: 'បោះបង់',
    close: 'បិទ',
    confirm: 'បញ្ជាក់',
    approve: 'អនុម័ត',
    reject: 'បដិសេធ',
    view: 'មើល',
    detail: 'ព័ត៌មានលម្អិត',
    action: 'សកម្មភាព',
    actions: 'សកម្មភាព',

    no: 'ល.រ',
    status: 'ស្ថានភាព',
    allStatus: 'ស្ថានភាពទាំងអស់',
    active: 'សកម្ម',
    inactive: 'អសកម្ម',
    yes: 'បាទ/ចាស',
    none: 'គ្មាន',
    unknown: 'មិនស្គាល់',
    warning: 'ការព្រមាន',

    fromDate: 'ចាប់ពីថ្ងៃ',
    toDate: 'ដល់ថ្ងៃ',
    date: 'កាលបរិច្ឆេទ',
    name: 'ឈ្មោះ',
    code: 'កូដ',
    description: 'ការពិពណ៌នា',
    createdAt: 'បានបង្កើតនៅ',
    updatedAt: 'បានកែប្រែនៅ',

    loaded: 'បានផ្ទុក {loaded} ក្នុងចំណោម {total}',
    noData: 'រកមិនឃើញទិន្នន័យ',
    somethingWentWrong: 'មានបញ្ហាកើតឡើង',
    loadFailed: 'ផ្ទុកមិនបានជោគជ័យ',
    createFailed: 'បង្កើតមិនបានជោគជ័យ',
    updateFailed: 'ធ្វើបច្ចុប្បន្នភាពមិនបានជោគជ័យ',
    saveFailed: 'រក្សាទុកមិនបានជោគជ័យ',
    downloadFailed: 'ទាញយកមិនបានជោគជ័យ',
    created: 'បានបង្កើត',
    updated: 'បានធ្វើបច្ចុប្បន្នភាព',
    downloaded: 'បានទាញយក',
    loadingData: 'កំពុងផ្ទុកទិន្នន័យ',
    fetchingRecords: 'កំពុងទាញយកកំណត់ត្រាពីម៉ាស៊ីនមេ។',

    openNavigation: 'បើកម៉ឺនុយរុករក',
    toggleDesktopSidebar: 'បិទ/បើករបារចំហៀងផ្ទៃតុ',
    toggleTheme: 'ប្តូររូបរាង',
    switchToLightMode: 'ប្តូរទៅរូបរាងភ្លឺ',
    switchToDarkMode: 'ប្តូរទៅរូបរាងងងឹត',
    notifications: 'ការជូនដំណឹង',
    language: 'ភាសា',
  },

  auth: {
    login: 'ចូលប្រើ',
    logout: 'ចាកចេញ',
    username: 'ឈ្មោះអ្នកប្រើ',
    loginId: 'លេខសម្គាល់ចូលប្រើ',
    password: 'ពាក្យសម្ងាត់',
    profile: 'ប្រវត្តិរូប',
    accessDenied: 'មិនមានសិទ្ធិចូលប្រើ',
    noPermission: 'អ្នកមិនមានសិទ្ធិចូលប្រើទំព័រនេះទេ។',
    loginSubtitle: 'ចូលប្រើដោយគណនីក្រុមហ៊ុនរបស់អ្នក ដើម្បីបន្ត។',
    loginIdPlaceholder: 'បញ្ចូលលេខសម្គាល់ចូលប្រើ',
    passwordPlaceholder: 'បញ្ចូលពាក្យសម្ងាត់',
    signingIn: 'កំពុងចូលប្រើ...',

    error: {
      loginFailed: 'ចូលប្រើមិនបានជោគជ័យ។ សូមព្យាយាមម្តងទៀត។',
    },

    account: {
      tableTitle: 'បញ្ជីគណនី',
      tableSubtitle: 'បញ្ជីគណនីពីម៉ាស៊ីនមេ ជាមួយការផ្ទុកបន្តិចម្តងៗ។',
      newAccount: 'គណនីថ្មី',
      searchPlaceholder: 'ស្វែងរក Login ID, ឈ្មោះបង្ហាញ, បុគ្គលិក, តួនាទី ឬសិទ្ធិ',
      noData: 'គ្មានគណនីដែលត្រូវនឹងតម្រងរបស់អ្នកទេ។',
      loadFailed: 'ផ្ទុកគណនីមិនបានជោគជ័យ។',

      displayName: 'ឈ្មោះបង្ហាញ',
      directPermissions: 'សិទ្ធិផ្ទាល់',
      mustChangePassword: 'ត្រូវប្តូរពាក្យសម្ងាត់',
      reset: 'កំណត់ឡើងវិញ',

      createTitle: 'បង្កើតគណនី',
      editTitle: 'កែប្រែគណនី',
      resetPassword: 'កំណត់ពាក្យសម្ងាត់ឡើងវិញ',
      newPassword: 'ពាក្យសម្ងាត់ថ្មី',
      forcePasswordChange: 'បង្ខំឱ្យប្តូរពាក្យសម្ងាត់បន្ទាប់ពីកំណត់ឡើងវិញ',
      resettingFor: 'កំពុងកំណត់ពាក្យសម្ងាត់ឡើងវិញសម្រាប់',

      selectEmployee: 'ជ្រើសបុគ្គលិក',
      selectRoles: 'ជ្រើសតួនាទី',
      directPermissionHelp: 'បំបែកកូដសិទ្ធិដោយសញ្ញាក្បៀស។',
      loginIdExample: 'ឧទាហរណ៍: john.smith',
      displayNameExample: 'ឧទាហរណ៍: John Smith',

      unnamedEmployee: 'បុគ្គលិកគ្មានឈ្មោះ',
      unnamedRole: 'តួនាទីគ្មានឈ្មោះ',
      employeeOptionsLoadFailed: 'ផ្ទុកជម្រើសបុគ្គលិកមិនបាន។',
      roleOptionsLoadFailed: 'ផ្ទុកជម្រើសតួនាទីមិនបាន។',

      createdSuccess: 'បានបង្កើតគណនីដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពគណនីដោយជោគជ័យ។',
      createFailed: 'បង្កើតគណនីមិនបានជោគជ័យ។',
      updateFailed: 'ធ្វើបច្ចុប្បន្នភាពគណនីមិនបានជោគជ័យ។',
      passwordReset: 'បានកំណត់ពាក្យសម្ងាត់ឡើងវិញ',
      passwordResetSuccess: 'បានកំណត់ពាក្យសម្ងាត់ឡើងវិញដោយជោគជ័យ។',
      resetFailed: 'កំណត់ពាក្យសម្ងាត់ឡើងវិញមិនបានជោគជ័យ។',
    },
  },

  nav: {
    workspace: 'កន្លែងធ្វើការ',
    dashboard: 'ផ្ទាំងគ្រប់គ្រង',

    organization: 'អង្គភាព',
    permissions: 'សិទ្ធិ',
    roles: 'តួនាទី',
    departments: 'ផ្នែក',
    positions: 'មុខតំណែង',
    lines: 'ខ្សែផលិតកម្ម',
    employees: 'បុគ្គលិក',
    orgChart: 'គំនូសតាងអង្គភាព',

    calendar: 'ប្រតិទិន',
    holidayMaster: 'បញ្ជីថ្ងៃឈប់សម្រាក',

    shift: 'វេន',
    shiftMaster: 'បញ្ជីវេន',

    accessControl: 'ការគ្រប់គ្រងសិទ្ធិចូលប្រើ',
    accounts: 'គណនី',

    attendance: 'វត្តមាន',
    attendanceImport: 'នាំចូលវត្តមាន',
    attendanceRecords: 'កំណត់ត្រាវត្តមាន',
    otVerification: 'ផ្ទៀងផ្ទាត់ OT',

    overtime: 'ម៉ោងបន្ថែម',
    otRequests: 'សំណើ OT',
    approvalInbox: 'ប្រអប់អនុម័ត',
    acknowledgeInbox: 'ប្រអប់ទទួលជ្រាប',
    otPolicies: 'គោលការណ៍ OT',
    shiftOtOptions: 'ជម្រើស OT តាមវេន',

    payment: 'ការទូទាត់',
    paymentProcess: 'ដំណើរការទូទាត់',
    paymentFormulas: 'រូបមន្តទូទាត់',
  },

  access: {
    permission: {
      tableTitle: 'បញ្ជីសិទ្ធិ',
      searchPlaceholder: 'ស្វែងរកកូដសិទ្ធិ ឈ្មោះ ម៉ូឌុល ឬការពិពណ៌នា',
      module: 'ម៉ូឌុល',
      allModules: 'ម៉ូឌុលទាំងអស់',

      loading: 'កំពុងផ្ទុកសិទ្ធិ...',
      noData: 'គ្មានសិទ្ធិដែលត្រូវនឹងតម្រងរបស់អ្នកទេ។',
      loadFailed: 'ផ្ទុកសិទ្ធិមិនបានជោគជ័យ។',
    },

    role: {
      tableTitle: 'បញ្ជីតួនាទី',
      searchPlaceholder: 'ស្វែងរកកូដតួនាទី ឬឈ្មោះបង្ហាញ',

      newRole: 'តួនាទីថ្មី',
      expandAll: 'ពង្រីកទាំងអស់',
      collapseAll: 'បង្រួមទាំងអស់',

      createTitle: 'បង្កើតតួនាទី',
      editTitle: 'កែប្រែតួនាទី',
      roleCode: 'កូដតួនាទី',
      roleCodeExample: 'ឧទាហរណ៍: SYSTEM_ADMIN',
      displayName: 'ឈ្មោះបង្ហាញ',
      displayNameExample: 'ឧទាហរណ៍: System Admin',

      permissionsByModule: 'សិទ្ធិតាមម៉ូឌុល',
      fullPermissions: 'សិទ្ធិពេញលេញ',
      count: 'ចំនួន',
      selectedCount: 'បានជ្រើស {count}',
      moduleSelectedCount: 'បានជ្រើស {selected} ក្នុងចំណោម {total}',
      morePermissions: '+{count} ទៀត',

      noData: 'គ្មានតួនាទីដែលត្រូវនឹងតម្រងរបស់អ្នកទេ។',
      loadFailed: 'ផ្ទុកតួនាទីមិនបានជោគជ័យ។',
      saveFailed: 'រក្សាទុកតួនាទីមិនបានជោគជ័យ។',
      createdSuccess: 'បានបង្កើតតួនាទីដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពតួនាទីដោយជោគជ័យ។',
    },
  },

  org: {
    department: {
      tableTitle: 'បញ្ជីផ្នែក',
      searchPlaceholder: 'ស្វែងរកកូដ ឈ្មោះ ឬការពិពណ៌នា',

      newDepartment: 'ផ្នែកថ្មី',
      importExcel: 'នាំចូល Excel',
      exportExcel: 'នាំចេញ Excel',

      createTitle: 'បង្កើតផ្នែក',
      editTitle: 'កែប្រែផ្នែក',
      departmentCode: 'កូដផ្នែក',
      departmentName: 'ឈ្មោះផ្នែក',
      codeExample: 'ឧទាហរណ៍: HR',
      nameExample: 'ឧទាហរណ៍: Human Resources',
      descriptionPlaceholder: 'ការពិពណ៌នាផ្នែក បើមាន',

      exported: 'បាននាំចេញ',
      exportedSuccess: 'បាននាំចេញ Excel ផ្នែកដោយជោគជ័យ។',
      exportFailed: 'នាំចេញមិនបានជោគជ័យ',

      imported: 'បាននាំចូល',
      importedSuccess: 'ការនាំចូលបានបញ្ចប់។ បានបង្កើត: {created}, បានកែប្រែ: {updated}។',
      importTitle: 'នាំចូល Excel ផ្នែក',
      importGuideTitle: 'ការណែនាំនាំចូល',
      importGuideStep1: 'ទាញយកឯកសារគំរូ។',
      importGuideStep2: 'បំពេញទិន្នន័យផ្នែកតាមទម្រង់ដូចគ្នា។',
      importGuideStep3: 'ជ្រើសឯកសារ Excel ដែលបានបំពេញពីកុំព្យូទ័ររបស់អ្នក។',
      importGuideStep4: 'ចុច នាំចូល ដើម្បីផ្ទុកឡើង និងដំណើរការ។',
      downloadSample: 'ទាញយកគំរូ',
      downloadSampleFailed: 'ទាញយកគំរូមិនបាន',
      sampleDownloaded: 'បានទាញយកឯកសារគំរូដោយជោគជ័យ។',
      excelFile: 'ឯកសារ Excel',
      chooseFile: 'ជ្រើសឯកសារ',
      noFileSelected: 'មិនទាន់ជ្រើសឯកសារ',
      importInvalidFileTitle: 'ប្រភេទឯកសារមិនត្រឹមត្រូវ',
      importInvalidFileMessage: 'សូមជ្រើសតែឯកសារ Excel: .xlsx, .xls ឬ .csv។',
      importFailed: 'នាំចូលមិនបានជោគជ័យ',

      noData: 'គ្មានផ្នែកដែលត្រូវនឹងតម្រងរបស់អ្នកទេ។',
      loadFailed: 'ផ្ទុកផ្នែកមិនបានជោគជ័យ។',
      saveFailed: 'រក្សាទុកផ្នែកមិនបានជោគជ័យ។',
      createdSuccess: 'បានបង្កើតផ្នែកដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពផ្នែកដោយជោគជ័យ។',
    },

    position: {
      tableTitle: 'បញ្ជីមុខតំណែង',
      searchPlaceholder: 'ស្វែងរកកូដ ឈ្មោះ ឬការពិពណ៌នា',

      department: 'ផ្នែក',
      allDepartments: 'ផ្នែកទាំងអស់',

      hierarchyScope: 'វិសាលភាពលំដាប់ថ្នាក់',
      allScopes: 'វិសាលភាពទាំងអស់',
      selectHierarchyScope: 'ជ្រើសវិសាលភាពលំដាប់ថ្នាក់',
      scopeSameLine: 'ខ្សែដូចគ្នា',
      scopeGlobal: 'ទូទៅ',
      scopeCrossDepartment: 'ឆ្លងផ្នែក',

      newPosition: 'មុខតំណែងថ្មី',
      importExcel: 'នាំចូល Excel',
      exportExcel: 'នាំចេញ Excel',

      createTitle: 'បង្កើតមុខតំណែង',
      editTitle: 'កែប្រែមុខតំណែង',
      positionCode: 'កូដមុខតំណែង',
      positionName: 'ឈ្មោះមុខតំណែង',
      codeExample: 'ឧទាហរណ៍: SW',
      nameExample: 'ឧទាហរណ៍: Sewer',
      selectDepartment: 'ជ្រើសផ្នែក',

      reportsToPosition: 'រាយការណ៍ទៅមុខតំណែង',
      selectReportsToPosition: 'ស្រេចចិត្ត: ជ្រើសមុខតំណែងមេ/អ្នកគ្រប់គ្រង',
      reportsToHelp:
        'ឧទាហរណ៍: Sewer រាយការណ៍ទៅ Sewer Supervisor។ អនុញ្ញាតឱ្យរាយការណ៍ឆ្លងផ្នែក។',

      managerScope: 'វិសាលភាពអ្នកគ្រប់គ្រង',
      sameLine: 'ខ្សែដូចគ្នា',
      global: 'ទូទៅ',
      managerScopeHelp:
        'ខ្សែដូចគ្នា = ស្វែងរកអ្នកគ្រប់គ្រងក្នុងខ្សែផលិតកម្មដូចគ្នា។ ទូទៅ = ស្វែងរកអ្នកគ្រប់គ្រងតាមមុខតំណែងមេឆ្លងផ្នែក។',

      level: 'កម្រិត',
      activeHelp: 'មុខតំណែងអសកម្មនឹងត្រូវបានលាក់ពីជម្រើសកំណត់បុគ្គលិកធម្មតា។',
      descriptionPlaceholder: 'ការពិពណ៌នាមុខតំណែង បើមាន',

      exported: 'បាននាំចេញ',
      exportedSuccess: 'បាននាំចេញ Excel មុខតំណែងដោយជោគជ័យ។',
      exportFailed: 'នាំចេញមិនបានជោគជ័យ',

      imported: 'បាននាំចូល',
      importedSuccess:
        'ការនាំចូលបានបញ្ចប់។ បានបង្កើត: {created}, បានកែប្រែ: {updated}, បរាជ័យ: {failed}។',
      importTitle: 'នាំចូល Excel មុខតំណែង',
      importGuideTitle: 'ការណែនាំនាំចូល',
      importGuideStep1: 'ទាញយកឯកសារគំរូ។',
      importGuideStep2: 'បំពេញទិន្នន័យមុខតំណែងដោយប្រើកូដដែលអាចអានបានប៉ុណ្ណោះ។',
      importGuideStep3: 'កូដផ្នែកត្រូវតែមាននៅក្នុងទិន្នន័យមេផ្នែកជាមុន។',
      importGuideStep4:
        'កូដមុខតំណែងដែលត្រូវរាយការណ៍ទៅ ត្រូវតែមានជាមុន ឬមានក្នុងឯកសារនាំចូលដូចគ្នា។',
      importGuideStep5: 'ចុច នាំចូល ដើម្បីផ្ទុកឡើង និងដំណើរការ។',
      importNote:
        'អ្នកប្រើមិនចាំបាច់ប្រើ Mongo ID ក្នុង Excel ទេ។ ប្រើកូដដែលអាចអានបាន ដូចជា Department Code និង Position Code។',

      downloadSample: 'ទាញយកគំរូ',
      downloadSampleFailed: 'ទាញយកគំរូមិនបាន',
      sampleDownloaded: 'បានទាញយកឯកសារគំរូដោយជោគជ័យ។',
      excelFile: 'ឯកសារ Excel',
      chooseFile: 'ជ្រើសឯកសារ',
      noFileSelected: 'មិនទាន់ជ្រើសឯកសារ',
      importInvalidFileTitle: 'ប្រភេទឯកសារមិនត្រឹមត្រូវ',
      importInvalidFileMessage:
        'សូមជ្រើសតែឯកសារ Excel: .xlsx, .xls ឬ .csv។',
      importFailed: 'នាំចូលមិនបានជោគជ័យ',

      noData: 'គ្មានមុខតំណែងដែលត្រូវនឹងតម្រងរបស់អ្នកទេ។',
      loadFailed: 'ផ្ទុកមុខតំណែងមិនបានជោគជ័យ។',
      departmentLoadFailed: 'ផ្ទុកផ្នែកមិនបានជោគជ័យ។',
      departmentLookupFailed: 'ផ្ទុកជម្រើសផ្នែកមិនបានជោគជ័យ។',
      parentLoadFailed: 'ផ្ទុកមុខតំណែងមេមិនបានជោគជ័យ។',
      reportsToLookupFailed: 'ផ្ទុកជម្រើសមុខតំណែងមេមិនបានជោគជ័យ។',
      saveFailed: 'រក្សាទុកមុខតំណែងមិនបានជោគជ័យ។',
      createdSuccess: 'បានបង្កើតមុខតំណែងដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពមុខតំណែងដោយជោគជ័យ។',
    },

    employee: {
      tableTitle: 'បញ្ជីបុគ្គលិក',
      searchPlaceholder: 'ស្វែងរកកូដបុគ្គលិក ឈ្មោះ ទូរស័ព្ទ អ៊ីមែល ឬតួនាទី',

      allDepartments: 'ផ្នែកទាំងអស់',
      allPositions: 'មុខតំណែងទាំងអស់',
      allLines: 'ខ្សែទាំងអស់',
      allShifts: 'វេនទាំងអស់',

      newEmployee: 'បុគ្គលិកថ្មី',
      importExcel: 'នាំចូល Excel',
      exportExcel: 'នាំចេញ Excel',

      createTitle: 'បង្កើតបុគ្គលិក',
      editTitle: 'កែប្រែបុគ្គលិក',

      employeeCode: 'កូដបុគ្គលិក',
      displayName: 'ឈ្មោះបង្ហាញ',
      employeeCodeExample: 'ឧទាហរណ៍: TRX001',
      displayNameExample: 'ឧទាហរណ៍: John Smith',

      selectDepartment: 'ជ្រើសផ្នែក',
      selectPosition: 'ជ្រើសមុខតំណែង',
      selectLine: 'ជ្រើសខ្សែ',
      selectShift: 'ជ្រើសវេន',
      selectManager: 'ជ្រើសអ្នកគ្រប់គ្រង/ប្រធាន',

      manager: 'អ្នកគ្រប់គ្រង',
      noManager: 'គ្មានអ្នកគ្រប់គ្រង',

      otRole: 'តួនាទី OT',
      otWorkflowRole: {
        none: 'គ្មាន',
        approver: 'អ្នកអនុម័ត',
        acknowledge: 'អ្នកទទួលជ្រាប',
      },

      joinDate: 'ថ្ងៃចូលធ្វើការ',
      email: 'អ៊ីមែល',
      phone: 'ទូរស័ព្ទ',
      phonePlaceholder: 'ឧទាហរណ៍: 012345678',

      hasAccount: 'មានគណនី',
      noAccount: 'គ្មានគណនី',
      accountAlreadyExists: 'បុគ្គលិកនេះមានគណនីចូលប្រើរួចហើយ។',
      createLoginAccount: 'បង្កើតគណនីចូលប្រើ',

      accountDefaultNoAccount: 'លំនាំដើម: មិនបង្កើតគណនីចូលប្រើទេ។',
      accountPreview: 'Login ID: {loginId} · ពាក្យសម្ងាត់លំនាំដើម: {password}',

      accountLoginIdPlaceholder: 'លំនាំដើម: កូដបុគ្គលិក',
      defaultPassword: 'ពាក្យសម្ងាត់លំនាំដើម',
      defaultPasswordPlaceholder: 'លំនាំដើម: កូដបុគ្គលិក + លេខទូរស័ព្ទ',

      accountPhoneRequired:
        'ត្រូវការលេខទូរស័ព្ទ ពេលបង្កើតគណនីចូលប្រើ ព្រោះពាក្យសម្ងាត់លំនាំដើមប្រើ កូដបុគ្គលិក + លេខទូរស័ព្ទ។',

      accountActive: 'គណនីសកម្ម',

      createdWithAccountSuccess: 'បានបង្កើតបុគ្គលិក និងគណនីចូលប្រើដោយជោគជ័យ។',
      updatedWithAccountSuccess: 'បានធ្វើបច្ចុប្បន្នភាពបុគ្គលិក និងបង្កើតគណនីចូលប្រើដោយជោគជ័យ។',

      exported: 'បាននាំចេញ',
      exportedSuccess: 'បាននាំចេញ Excel បុគ្គលិកដោយជោគជ័យ។',
      exportFailed: 'នាំចេញមិនបានជោគជ័យ',

      imported: 'បាននាំចូល',
      importedSuccess: 'ការនាំចូលបានបញ្ចប់។ បានបង្កើត: {created}, បានកែប្រែ: {updated}។',

      importTitle: 'នាំចូល Excel បុគ្គលិក',
      importGuideTitle: 'ការណែនាំនាំចូល',
      importGuideStep1: 'ទាញយកឯកសារគំរូ។',
      importGuideStep2: 'បំពេញទិន្នន័យបុគ្គលិកដោយប្រើកូដដែលអាចអានបានប៉ុណ្ណោះ។',
      importGuideStep3: 'ទម្រង់ថ្ងៃចូលធ្វើការ ត្រូវជា DD/MM/YYYY ឧទាហរណ៍ 30/04/2026។',
      importGuideStep4:
        'Department Code, Position Code, Line Code និង Shift Code ត្រូវតែមាននៅក្នុងទិន្នន័យមេជាមុន។',
      importGuideStep5:
        'ប្រើ Reports To Employee Code សម្រាប់អ្នកគ្រប់គ្រង/ប្រធាន បន្ទាប់មកចុច នាំចូល។',

      downloadSample: 'ទាញយកគំរូ',
      downloadSampleFailed: 'ទាញយកគំរូមិនបាន',
      sampleDownloaded: 'បានទាញយកឯកសារគំរូដោយជោគជ័យ។',

      excelFile: 'ឯកសារ Excel',
      chooseFile: 'ជ្រើសឯកសារ',
      noFileSelected: 'មិនទាន់ជ្រើសឯកសារ',

      importInvalidFileTitle: 'ប្រភេទឯកសារមិនត្រឹមត្រូវ',
      importInvalidFileMessage:
        'សូមជ្រើសតែឯកសារ Excel: .xlsx, .xls ឬ .csv។',
      importFailed: 'នាំចូលមិនបានជោគជ័យ',

      invalidExcelData: 'ទិន្នន័យ Excel មិនត្រឹមត្រូវ',
      importApiNotFound: 'រកមិនឃើញ API នាំចូល',
      duplicateData: 'ទិន្នន័យស្ទួន',
      serverError: 'កំហុសម៉ាស៊ីនមេ',

      employeeCodeRequiredHelp:
        'ត្រូវការកូដបុគ្គលិក ព្រោះប្រព័ន្ធប្រើវាជាគន្លឹះបុគ្គលិកដែលអាចអានបាន។',
      joinDateFormatHelp:
        'សូមប្រើទម្រង់ DD/MM/YYYY ឧទាហរណ៍ 30/04/2026។',
      checkDepartmentMaster: 'សូមពិនិត្យទិន្នន័យមេផ្នែក។',
      checkPositionMaster: 'សូមពិនិត្យទិន្នន័យមេមុខតំណែង។',
      positionDepartmentMismatchHelp:
        'Position Code ត្រូវតែស្ថិតនៅក្រោម Department Code ដែលបានជ្រើស។',
      checkLineMaster: 'សូមពិនិត្យទិន្នន័យមេខ្សែផលិតកម្ម។',
      checkShiftMaster: 'សូមពិនិត្យទិន្នន័យមេវេន។',
      checkManagerEmployeeCode:
        'សូមនាំចូលអ្នកគ្រប់គ្រងជាមុន ឬប្រើ Employee Code របស់អ្នកគ្រប់គ្រងដែលមានស្រាប់។',
      uniqueEmailHelp: 'អ៊ីមែលត្រូវតែមិនស្ទួន ឬទុកឱ្យទទេ។',

      noData: 'គ្មានបុគ្គលិកដែលត្រូវនឹងតម្រងរបស់អ្នកទេ។',
      loadFailed: 'ផ្ទុកបុគ្គលិកមិនបានជោគជ័យ។',
      departmentLoadFailed: 'ផ្ទុកផ្នែកមិនបានជោគជ័យ។',
      positionLoadFailed: 'ផ្ទុកមុខតំណែងមិនបានជោគជ័យ។',
      lineLoadFailed: 'ផ្ទុកខ្សែផលិតកម្មមិនបានជោគជ័យ។',
      shiftLoadFailed: 'ផ្ទុកវេនមិនបានជោគជ័យ។',
      managerLoadFailed: 'ផ្ទុកអ្នកគ្រប់គ្រងមិនបានជោគជ័យ។',
      saveFailed: 'រក្សាទុកបុគ្គលិកមិនបានជោគជ័យ។',
      createdSuccess: 'បានបង្កើតបុគ្គលិកដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពបុគ្គលិកដោយជោគជ័យ។',
    },

    line: {
      tableTitle: 'បញ្ជីខ្សែផលិតកម្ម',
      searchPlaceholder: 'ស្វែងរកកូដ ឈ្មោះ ឬការពិពណ៌នា',

      department: 'ផ្នែក',
      allDepartments: 'ផ្នែកទាំងអស់',

      lineCode: 'កូដខ្សែ',
      lineName: 'ឈ្មោះខ្សែ',
      allowedPositions: 'មុខតំណែងដែលអនុញ្ញាត',
      allPositionsInDepartment: 'មុខតំណែងទាំងអស់ក្នុងផ្នែក',

      newLine: 'ខ្សែថ្មី',
      importExcel: 'នាំចូល Excel',
      exportExcel: 'នាំចេញ Excel',

      createTitle: 'បង្កើតខ្សែផលិតកម្ម',
      editTitle: 'កែប្រែខ្សែផលិតកម្ម',
      selectDepartment: 'ជ្រើសផ្នែក',
      selectAllowedPositions: 'ស្រេចចិត្ត: ជ្រើសមុខតំណែងដែលអនុញ្ញាត',
      codeExample: 'ឧទាហរណ៍: LINE-01',
      nameExample: 'ឧទាហរណ៍: Sewing Line 01',
      descriptionPlaceholder: 'ការពិពណ៌នាខ្សែផលិតកម្ម បើមាន',

      exported: 'បាននាំចេញ',
      exportedSuccess: 'បាននាំចេញខ្សែផលិតកម្មដោយជោគជ័យ។',
      exportFailed: 'នាំចេញខ្សែផលិតកម្មមិនបានជោគជ័យ។',

      imported: 'បាននាំចូល',
      importedSuccess: 'ការនាំចូលបានបញ្ចប់។ បានបង្កើត: {created}, បានកែប្រែ: {updated}។',

      importTitle: 'នាំចូលខ្សែផលិតកម្ម',
      importGuideTitle: 'ការណែនាំនាំចូល',
      importGuideStep1: 'ទាញយកឯកសារគំរូ។',
      importGuideStep2: 'បំពេញទិន្នន័យខ្សែផលិតកម្មដោយប្រើកូដដែលអាចអានបានប៉ុណ្ណោះ។',
      importGuideStep3: 'Department Code ត្រូវតែមាននៅក្នុងទិន្នន័យមេផ្នែកជាមុន។',
      importGuideStep4: 'ប្រើ Position Codes តែពេលខ្សែអនុញ្ញាតមុខតំណែងជាក់លាក់។',

      downloadSample: 'ទាញយកគំរូ',
      downloadSampleFailed: 'ទាញយកគំរូមិនបាន',
      sampleDownloaded: 'បានទាញយកឯកសារគំរូដោយជោគជ័យ។',

      excelFile: 'ឯកសារ Excel',
      chooseFile: 'ជ្រើសឯកសារ',
      noFileSelected: 'មិនទាន់ជ្រើសឯកសារ',

      importInvalidFileTitle: 'ប្រភេទឯកសារមិនត្រឹមត្រូវ',
      importInvalidFileMessage:
        'សូមជ្រើសតែឯកសារ Excel: .xlsx, .xls ឬ .csv។',
      importFailed: 'នាំចូលមិនបានជោគជ័យ',

      noData: 'គ្មានខ្សែផលិតកម្មដែលត្រូវនឹងតម្រងរបស់អ្នកទេ។',
      loadFailed: 'ផ្ទុកខ្សែផលិតកម្មមិនបានជោគជ័យ។',
      departmentLoadFailed: 'ផ្ទុកផ្នែកមិនបានជោគជ័យ។',
      positionLoadFailed: 'ផ្ទុកមុខតំណែងមិនបានជោគជ័យ។',
      saveFailed: 'រក្សាទុកខ្សែផលិតកម្មមិនបានជោគជ័យ។',
      createdSuccess: 'បានបង្កើតខ្សែផលិតកម្មដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពខ្សែផលិតកម្មដោយជោគជ័យ។',
    },

    orgChart: {
      searchPlaceholder: 'ស្វែងរកកូដបុគ្គលិក ឬឈ្មោះ',
      rootPerson: 'បុគ្គលិកកំពូល',
      selectRootPerson: 'ជ្រើសបុគ្គលិកកំពូល',
      includeInactive: 'រួមបញ្ចូលអសកម្ម',

      treeTitle: 'គំនូសតាងអង្គភាព',
      zoomLabel: 'ពង្រីក: {zoom}',
      zoomIn: 'ពង្រីក',
      zoomOut: 'បង្រួម',
      resetZoom: 'កំណត់ឡើងវិញ',

      noEmployeeCode: 'គ្មាន ID',
      noPosition: 'គ្មានមុខតំណែង',
      noDepartment: 'គ្មានផ្នែក',

      noTreeData: 'រកមិនឃើញទិន្នន័យគំនូសតាងអង្គភាព។',
      loadFailed: 'ផ្ទុកគំនូសតាងអង្គភាពមិនបានជោគជ័យ។',

      expandNode: 'ពង្រីកថ្នាំង',
      collapseNode: 'បង្រួមថ្នាំង',
    },
  },

  calendar: {
    holidayPicker: {
      selectDate: 'ជ្រើសកាលបរិច្ឆេទ',
      loadingHolidays: 'កំពុងផ្ទុកថ្ងៃឈប់សម្រាក...',
      activeHolidayCount: 'ថ្ងៃឈប់សម្រាកសកម្ម {count}',
      sunday: 'ថ្ងៃអាទិត្យ',
      workingDay: 'ថ្ងៃធ្វើការ',
      holiday: 'ថ្ងៃឈប់សម្រាក',
      today: 'ថ្ងៃនេះ',
      clear: 'សម្អាត',

      week: {
        sun: 'អា',
        mon: 'ច',
        tue: 'អ',
        wed: 'ពុ',
        thu: 'ព្រ',
        fri: 'សុ',
        sat: 'ស',
      },
    },

    holiday: {
      tableTitle: 'ប្រតិទិនថ្ងៃឈប់សម្រាក',
      previewTitle: 'មើលប្រតិទិនជាមុន',
      previewCount: 'ថ្ងៃឈប់សម្រាក',
      activeHolidays: 'ថ្ងៃឈប់សម្រាកសកម្ម',
      selectedDate: 'កាលបរិច្ឆេទដែលបានជ្រើស',

      searchPlaceholder: 'ស្វែងរកកូដ ឈ្មោះ ឬការពិពណ៌នា',
      noData: 'រកមិនឃើញថ្ងៃឈប់សម្រាក។',
      loadFailed: 'ផ្ទុកថ្ងៃឈប់សម្រាកមិនបានជោគជ័យ។',

      importExcel: 'នាំចូល Excel',
      exportExcel: 'នាំចេញ Excel',
      newHoliday: 'ថ្ងៃឈប់សម្រាកថ្មី',
      createTitle: 'បង្កើតថ្ងៃឈប់សម្រាក',
      editTitle: 'កែប្រែថ្ងៃឈប់សម្រាក',
      createOnSelectedDate: 'បង្កើត',
      editHoliday: 'កែប្រែ',

      selectHolidayDate: 'ជ្រើសកាលបរិច្ឆេទថ្ងៃឈប់សម្រាក',
      holidayCode: 'កូដថ្ងៃឈប់សម្រាក',
      codeExample: 'ឧទាហរណ៍: KHNY',
      holidayName: 'ឈ្មោះថ្ងៃឈប់សម្រាក',
      nameExample: 'ឧទាហរណ៍: បុណ្យចូលឆ្នាំខ្មែរ',
      descriptionPlaceholder: 'កំណត់ចំណាំ ឬការពិពណ៌នា បើមាន',
      selectedDayType: 'ប្រភេទថ្ងៃដែលបានជ្រើស',

      paidHoliday: 'ថ្ងៃឈប់សម្រាកមានប្រាក់ឈ្នួល',
      paidHolidayHelp: 'ប្រើជម្រើសនេះ ពេលថ្ងៃឈប់សម្រាកមានប្រាក់ឈ្នួល។',
      activeHelp: 'ថ្ងៃឈប់សម្រាកអសកម្មនឹងមិនត្រូវបានប្រើសម្រាប់កំណត់ប្រភេទថ្ងៃទេ។',
      paid: 'មានប្រាក់ឈ្នួល',
      unpaid: 'គ្មានប្រាក់ឈ្នួល',
      noCode: 'គ្មានកូដ',

      createdSuccess: 'បានបង្កើតថ្ងៃឈប់សម្រាកដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពថ្ងៃឈប់សម្រាកដោយជោគជ័យ។',
      saveFailed: 'រក្សាទុកថ្ងៃឈប់សម្រាកមិនបានជោគជ័យ។',

      exported: 'បាននាំចេញ',
      exportedSuccess: 'បាននាំចេញ Excel ថ្ងៃឈប់សម្រាកដោយជោគជ័យ។',
      exportFailed: 'នាំចេញថ្ងៃឈប់សម្រាកមិនបានជោគជ័យ។',

      importTitle: 'នាំចូលថ្ងៃឈប់សម្រាក',
      importInvalidFileTitle: 'ឯកសារមិនត្រឹមត្រូវ',
      importInvalidFileMessage: 'សូមជ្រើសឯកសារ Excel ឬ CSV។',
      importFailed: 'នាំចូលថ្ងៃឈប់សម្រាកមិនបានជោគជ័យ។',
      imported: 'បាននាំចូល',
      importedSuccess: 'ការនាំចូលបានបញ្ចប់។ បានបង្កើត: {created}, បានកែប្រែ: {updated}។',

      importGuideTitle: 'ការណែនាំនាំចូល',
      importGuideStep1: 'ទាញយកឯកសារគំរូ។',
      importGuideStep2: 'បំពេញកាលបរិច្ឆេទថ្ងៃឈប់សម្រាក កូដ ឈ្មោះ មានប្រាក់ឈ្នួល និងស្ថានភាពសកម្ម។',
      importGuideStep3: 'ប្រើទម្រង់ DD/MM/YYYY សម្រាប់កាលបរិច្ឆេទ។',
      importGuideStep4: 'ផ្ទុកឡើងឯកសារដែលបានបំពេញ។',
      importNote:
        'ថ្ងៃឈប់សម្រាកដែលមានកាលបរិច្ឆេទ ឬកូដដូចគ្នា អាចត្រូវបានធ្វើបច្ចុប្បន្នភាព អាស្រ័យលើច្បាប់នាំចូលរបស់ backend។',

      downloadSample: 'ទាញយកគំរូ',
      sampleDownloaded: 'បានទាញយកគំរូ។',
      downloadSampleFailed: 'ទាញយកគំរូមិនបាន។',

      excelFile: 'ឯកសារ Excel',
      noFileSelected: 'មិនទាន់ជ្រើសឯកសារ',
      chooseFile: 'ជ្រើសឯកសារ',
    },
  },

  shift: {
    pageTitle: 'បញ្ជីវេន',
    pageSubtitle: 'គ្រប់គ្រងវេនការងារ ម៉ោងសម្រាក ច្បាប់ឆ្លងរាត្រី និងការនាំចូល/នាំចេញ Excel។',
    tableTitle: 'បញ្ជីវេន',

    type: {
      day: 'ថ្ងៃ',
      night: 'យប់',
    },

    action: {
      importExcel: 'នាំចូល Excel',
      exportExcel: 'នាំចេញ Excel',
      newShift: 'វេនថ្មី',
      createShift: 'បង្កើតវេន',
    },

    permission: {
      noView: 'អ្នកមិនមានសិទ្ធិមើលវេនទេ។',
    },

    filter: {
      searchPlaceholder: 'ស្វែងរកកូដវេន ឬឈ្មោះ',
      type: 'ប្រភេទ',
      status: 'ស្ថានភាព',
      allTypes: 'ប្រភេទទាំងអស់',
      allStatuses: 'ស្ថានភាពទាំងអស់',
    },

    table: {
      loading: 'កំពុងផ្ទុកវេន...',
      updating: 'កំពុងធ្វើបច្ចុប្បន្នភាពវេន...',
      empty: 'គ្មានវេនដែលត្រូវនឹងតម្រងរបស់អ្នកទេ។',
      loadedSummary: 'បានផ្ទុក {loaded} ក្នុងចំណោម {total}',
    },

    column: {
      code: 'កូដ',
      name: 'ឈ្មោះ',
      type: 'ប្រភេទ',
      start: 'ចាប់ផ្តើម',
      breakStart: 'ចាប់ផ្តើមសម្រាក',
      breakEnd: 'បញ្ចប់សម្រាក',
      end: 'បញ្ចប់',
      crossMidnight: 'ឆ្លងរាត្រី',
      working: 'ម៉ោងធ្វើការ',
      status: 'ស្ថានភាព',
      createdAt: 'បានបង្កើតនៅ',
      actions: 'សកម្មភាព',
    },

    duration: {
      hours: '{hours}ម៉',
      minutes: '{minutes}ន',
      hoursMinutes: '{hours}ម៉ {minutes}ន',
    },

    dialog: {
      createTitle: 'បង្កើតវេន',
      editTitle: 'កែប្រែវេន',
    },

    form: {
      code: 'កូដវេន',
      name: 'ឈ្មោះវេន',
      type: 'ប្រភេទវេន',
      activeStatus: 'ស្ថានភាពសកម្ម',
      startTime: 'ម៉ោងចាប់ផ្តើម',
      breakStartTime: 'ចាប់ផ្តើមសម្រាក',
      breakEndTime: 'បញ្ចប់សម្រាក',
      endTime: 'ម៉ោងបញ្ចប់',
      codePlaceholder: 'ឧទាហរណ៍: DAY-0700',
      namePlaceholder: 'ឧទាហរណ៍: Day Shift 07:00 - 16:00',
      typePlaceholder: 'ជ្រើសប្រភេទ',
      timeHint:
        'ប្រើទម្រង់ HH:mm។ វេនថ្ងៃមិនអាចឆ្លងរាត្រីបានទេ។ វេនយប់ត្រូវតែឆ្លងរាត្រី។ ម៉ោងសម្រាកត្រូវស្ថិតនៅក្នុងម៉ោងវេន។',
    },

    import: {
      title: 'នាំចូលវេន',
      guideTitle: 'ការណែនាំនាំចូល',
      guideStep1: 'ទាញយកឯកសារគំរូ។',
      guideStep2: 'បំពេញទិន្នន័យវេនដោយប្រើកូដវេនដែលអាចអានបានប៉ុណ្ណោះ។',
      guideStep3: 'ប្រើទម្រង់ HH:mm សម្រាប់វាលម៉ោងទាំងអស់។',
      guideStep4: 'ប្រើ DAY សម្រាប់វេនក្នុងថ្ងៃដូចគ្នា និង NIGHT សម្រាប់វេនឆ្លងរាត្រី។',
      guideStep5: 'ជ្រើសឯកសារ Excel ដែលបានបំពេញ ហើយចុច នាំចូល។',

      formatTitle: 'ទម្រង់នាំចូល Excel',
      description:
        'ទាញយកឯកសារគំរូ បំពេញកំណត់ត្រាវេន បន្ទាប់មកផ្ទុកឡើងឯកសារ Excel ដែលបានបំពេញ។',
      ruleType: 'ប្រភេទត្រូវជា DAY ឬ NIGHT។',
      ruleTime: 'វាលម៉ោងត្រូវប្រើទម្រង់ HH:mm។',
      ruleDay: 'វេន DAY មិនអាចឆ្លងរាត្រីបានទេ។',
      ruleNight: 'វេន NIGHT ត្រូវតែឆ្លងរាត្រី។',

      fileLabel: 'ឯកសារ Excel',
      chooseFile: 'ជ្រើសឯកសារ',
      noFileSelected: 'មិនទាន់ជ្រើសឯកសារ',
      selectedFile: 'បានជ្រើស',
      downloadSample: 'ទាញយកគំរូ',
      sampleDownloaded: 'បានទាញយកឯកសារគំរូដោយជោគជ័យ។',
      import: 'នាំចូល',

      invalidExcelData: 'ទិន្នន័យ Excel មិនត្រឹមត្រូវ',
      importApiNotFound: 'រកមិនឃើញ API នាំចូល',
      duplicateData: 'ទិន្នន័យស្ទួន',
      serverError: 'កំហុសម៉ាស៊ីនមេ',

      helpCodeRequired:
        'ត្រូវការកូដវេន ព្រោះប្រព័ន្ធប្រើវាជាគន្លឹះវេនដែលអាចអានបាន។',
      helpType: 'ប្រភេទត្រូវជា DAY ឬ NIGHT។',
      helpStartTime: 'ម៉ោងចាប់ផ្តើមត្រូវប្រើទម្រង់ HH:mm ឧទាហរណ៍ 07:00។',
      helpBreakStartTime: 'ម៉ោងចាប់ផ្តើមសម្រាកត្រូវប្រើទម្រង់ HH:mm ឧទាហរណ៍ 12:00។',
      helpBreakEndTime: 'ម៉ោងបញ្ចប់សម្រាកត្រូវប្រើទម្រង់ HH:mm ឧទាហរណ៍ 13:00។',
      helpEndTime: 'ម៉ោងបញ្ចប់ត្រូវប្រើទម្រង់ HH:mm ឧទាហរណ៍ 16:00។',
      helpCrossMidnight:
        'វេន DAY ត្រូវបញ្ចប់ក្រោយម៉ោងចាប់ផ្តើមក្នុងថ្ងៃដូចគ្នា។ វេន NIGHT ត្រូវឆ្លងរាត្រី។',
      helpBreakInside: 'ម៉ោងសម្រាកត្រូវស្ថិតនៅក្នុងម៉ោងចាប់ផ្តើម និងបញ្ចប់វេន។',
      helpDuplicateCode: 'ប្រើកូដវេនមិនស្ទួន ឬធ្វើបច្ចុប្បន្នភាពកំណត់ត្រាវេនដែលមានស្រាប់។',

      toast: {
        invalidFileTitle: 'ប្រភេទឯកសារមិនត្រឹមត្រូវ',
        invalidFileDetail: 'សូមជ្រើសតែឯកសារ Excel: .xlsx, .xls ឬ .csv។',
        downloadFailedTitle: 'ទាញយកគំរូមិនបាន',
        downloadFailedDetail: 'ទាញយកឯកសារគំរូវេនមិនបាន។',
        importFailedTitle: 'នាំចូលមិនបានជោគជ័យ',
        importFailedDetail: 'នាំចូលឯកសារ Excel វេនមិនបាន។',
        importedTitle: 'បាននាំចូល',
        importedDetail:
          'ការនាំចូលបានបញ្ចប់។ សរុប: {total}, បានបង្កើត: {created}, បានកែប្រែ: {updated}។',
      },
    },

    toast: {
      loadFailedTitle: 'ផ្ទុកមិនបាន',
      loadFailedDetail: 'ផ្ទុកវេនមិនបានជោគជ័យ។',
      createdTitle: 'បានបង្កើត',
      createdDetail: 'បានបង្កើតវេនដោយជោគជ័យ។',
      updatedTitle: 'បានកែប្រែ',
      updatedDetail: 'បានធ្វើបច្ចុប្បន្នភាពវេនដោយជោគជ័យ។',
      createFailedTitle: 'បង្កើតមិនបាន',
      saveFailedTitle: 'រក្សាទុកមិនបាន',
      saveFailedDetail: 'រក្សាទុកវេនមិនបានជោគជ័យ។',
      exportedTitle: 'បាននាំចេញ',
      exportedDetail: 'បាននាំចេញ Excel វេនដោយជោគជ័យ។',
      exportFailedTitle: 'នាំចេញមិនបាន',
      exportFailedDetail: 'នាំចេញវេនមិនបានជោគជ័យ។',
    },

    validation: {
      codeRequired: 'ត្រូវការកូដវេន។',
      codeTooLong: 'កូដវេនវែងពេក។',
      nameRequired: 'ត្រូវការឈ្មោះវេន។',
      nameTooLong: 'ឈ្មោះវេនវែងពេក។',
      typeInvalid: 'ប្រភេទវេនត្រូវជា DAY ឬ NIGHT។',
      startTimeInvalid: 'ម៉ោងចាប់ផ្តើមត្រូវប្រើទម្រង់ HH:mm។',
      breakStartTimeInvalid: 'ម៉ោងចាប់ផ្តើមសម្រាកត្រូវប្រើទម្រង់ HH:mm។',
      breakEndTimeInvalid: 'ម៉ោងបញ្ចប់សម្រាកត្រូវប្រើទម្រង់ HH:mm។',
      endTimeInvalid: 'ម៉ោងបញ្ចប់ត្រូវប្រើទម្រង់ HH:mm។',
      isActiveInvalid: 'ស្ថានភាពមិនត្រឹមត្រូវ។',
      shiftIdInvalid: 'Shift ID មិនត្រឹមត្រូវ។',
      updatePayloadRequired: 'សូមកែប្រែយ៉ាងហោចណាស់មួយវាល។',
    },

    error: {
      startEndSame: 'ម៉ោងចាប់ផ្តើម និងម៉ោងបញ្ចប់វេន មិនអាចដូចគ្នាបានទេ។',
      breakStartEndSame: 'ម៉ោងចាប់ផ្តើមសម្រាក និងម៉ោងបញ្ចប់សម្រាក មិនអាចដូចគ្នាបានទេ។',
      dayCannotCrossMidnight: 'វេន DAY មិនអាចឆ្លងរាត្រីបានទេ។',
      nightMustCrossMidnight: 'វេន NIGHT ត្រូវតែឆ្លងរាត្រី។',
      breakEndBeforeStart: 'ម៉ោងបញ្ចប់សម្រាកត្រូវក្រោយម៉ោងចាប់ផ្តើមសម្រាក។',
      breakOutsideShift: 'ម៉ោងសម្រាកត្រូវស្ថិតនៅក្នុងម៉ោងធ្វើការរបស់វេន។',
      codeExists: 'កូដវេនមានរួចហើយ។',
      notFound: 'រកមិនឃើញវេន។',
      excelFileRequired: 'ត្រូវការឯកសារ Excel។',
      excelNoRows: 'ឯកសារ Excel គ្មានជួរទិន្នន័យ។',
    },

    importError: {
      invalidStatus: 'ស្ថានភាពក្នុងឯកសារនាំចូលមិនត្រឹមត្រូវ។',
      rowInvalid: 'ទិន្នន័យជួរមិនត្រឹមត្រូវ។',
      duplicateShiftId: 'Shift ID ស្ទួនក្នុងឯកសារនាំចូល។',
      duplicateCode: 'កូដវេនស្ទួនក្នុងឯកសារនាំចូល។',
      shiftIdNotFound: 'រកមិនឃើញ Shift ID។',
    },
  },

  attendance: {
    title: 'វត្តមាន',
    importTitle: 'នាំចូលវត្តមាន',
    recordsTitle: 'កំណត់ត្រាវត្តមាន',
    verificationTitle: 'ផ្ទៀងផ្ទាត់វត្តមាន OT',

    importDialog: {
      title: 'នាំចូលវត្តមាន',
      guideTitle: 'ការណែនាំនាំចូល',
      guideStep1: 'ជ្រើសកាលបរិច្ឆេទវត្តមានពីប្រតិទិនដែលបង្ហាញថ្ងៃឈប់សម្រាក។',
      guideStep2: 'ទាញយកឯកសារគំរូ។',
      guideStep3: 'បំពេញ Employee ID, Clock In និង Clock Out។',
      guideStep4: 'ជ្រើសឯកសារ Excel ដែលបានបំពេញ ហើយចុច នាំចូល។',
      note: 'ត្រូវការកាលបរិច្ឆេទវត្តមាន។ Backend នឹងកំណត់ប្រភេទថ្ងៃពីប្រតិទិនថ្ងៃឈប់សម្រាក។',

      downloadSample: 'ទាញយកគំរូ',
      sampleDownloaded: 'បានទាញយកឯកសារគំរូដោយជោគជ័យ។',
      downloadFailed: 'ទាញយកមិនបាន',

      importCompleted: 'ការនាំចូលបានបញ្ចប់',
      importCompletedSuccess: 'បាននាំចូលវត្តមានដោយជោគជ័យ។',
      importCompletedPartial: 'បាននាំចូលវត្តមាន ប៉ុន្តែមានជួរមួយចំនួនត្រូវបានរំលង ឬមិនត្រឹមត្រូវ។',
      importFailed: 'នាំចូលមិនបានជោគជ័យ',

      validation: 'ការផ្ទៀងផ្ទាត់',
      invalidFile: 'ឯកសារមិនត្រឹមត្រូវ',
      invalidExcelData: 'ទិន្នន័យ Excel មិនត្រឹមត្រូវ',
      importApiNotFound: 'រកមិនឃើញ API នាំចូល',
      duplicateData: 'ទិន្នន័យស្ទួន',
      serverError: 'កំហុសម៉ាស៊ីនមេ',

      chooseExcelFile: 'សូមជ្រើសឯកសារ Excel។',
      invalidExcelFile: 'សូមផ្ទុកឡើងតែឯកសារ Excel: .xlsx, .xls ឬ .csv។',
      fileTooLarge: 'ទំហំឯកសារមិនត្រូវលើស 10 MB។',
      selectAttendanceDate: 'សូមជ្រើសកាលបរិច្ឆេទវត្តមាន។',
      failedDownloadSample: 'ទាញយកឯកសារគំរូមិនបាន។',
      failedImportFile: 'នាំចូលឯកសារវត្តមានមិនបាន។',

      checkEmployeeMaster: 'សូមពិនិត្យទិន្នន័យមេបុគ្គលិក។',
      checkShiftMaster: 'សូមពិនិត្យទិន្នន័យមេវេន។',
      dateFormatHelp: 'សូមពិនិត្យទម្រង់កាលបរិច្ឆេទក្នុងឯកសារ Excel។',
      timeFormatHelp: 'សូមប្រើទម្រង់ HH:mm សម្រាប់តម្លៃម៉ោង។',

      excelFile: 'ឯកសារ Excel',
      chooseFile: 'ជ្រើសឯកសារ',
      noFileSelected: 'មិនទាន់ជ្រើសឯកសារ',
    },

    import: {
      importAttendance: 'នាំចូលវត្តមាន',
      latestImportResult: 'លទ្ធផលនាំចូលចុងក្រោយ',
      latestImportDescription: 'ឯកសារដែលបានផ្ទុកឡើងចុងក្រោយ ត្រូវបានដំណើរការដោយម៉ាស៊ីននាំចូល backend។',
      failedRowPreview: 'មើលជួរបរាជ័យជាមុន',
      importHistory: 'ប្រវត្តិនាំចូល',
      importDetail: 'ព័ត៌មានលម្អិតការនាំចូលវត្តមាន',
      loadingImportDetail: 'កំពុងផ្ទុកព័ត៌មានលម្អិតការនាំចូល...',
      noImportDetail: 'រកមិនឃើញព័ត៌មានលម្អិត។',
      noImportRecords: 'គ្មានកំណត់ត្រានាំចូលក្នុងព័ត៌មានលម្អិតនេះទេ។',
      noImports: 'គ្មានការនាំចូលវត្តមានដែលត្រូវនឹងតម្រងរបស់អ្នកទេ។',
      detailLoadFailed: 'ផ្ទុកព័ត៌មានលម្អិតការនាំចូលវត្តមានមិនបាន។',
    },

    records: {
      attendanceList: 'បញ្ជីវត្តមាន',
      noRecords: 'គ្មានកំណត់ត្រាវត្តមានដែលត្រូវនឹងតម្រងរបស់អ្នកទេ។',
      loadFailed: 'ផ្ទុកកំណត់ត្រាវត្តមានមិនបានជោគជ័យ។',
    },

    field: {
      attendanceDate: 'កាលបរិច្ឆេទវត្តមាន',
      selectAttendanceDate: 'ជ្រើសកាលបរិច្ឆេទវត្តមាន',

      importNo: 'លេខនាំចូល',
      fileName: 'ឈ្មោះឯកសារ',
      period: 'រយៈពេល',
      periodFrom: 'ចាប់ពីរយៈពេល',
      periodTo: 'ដល់រយៈពេល',
      row: 'ជួរ',
      rows: 'ជួរ',

      totalRows: 'ជួរសរុប',
      successRows: 'ជោគជ័យ',
      failedRows: 'បរាជ័យ',
      duplicateRows: 'ស្ទួន',
      overriddenRows: 'បានជំនួស',
      importedAt: 'បាននាំចូលនៅ',

      employee: 'បុគ្គលិក',
      employeeNo: 'លេខបុគ្គលិក',
      importedEmployee: 'បាននាំចូល',
      department: 'ផ្នែក',
      position: 'មុខតំណែង',
      line: 'ខ្សែ',
      shift: 'វេន',

      scanIn: 'ស្កេនចូល',
      scanOut: 'ស្កេនចេញ',
      clockIn: 'ម៉ោងចូល',
      clockOut: 'ម៉ោងចេញ',

      status: 'ស្ថានភាព',
      importedStatus: 'ស្ថានភាពនាំចូល',
      derivedStatus: 'ស្ថានភាពគណនា',
      shiftStatus: 'ស្ថានភាពវេន',
      shiftMatch: 'ផ្គូផ្គងវេន',
      dayType: 'ប្រភេទថ្ងៃ',

      worked: 'បានធ្វើការ',
      late: 'យឺត',
      earlyOut: 'ចេញមុន',
      issues: 'បញ្ហា',

      searchImportPlaceholder: 'ស្វែងរកលេខនាំចូល ឈ្មោះឯកសារ កំណត់សម្គាល់',
      searchRecordsPlaceholder: 'ស្វែងរកបុគ្គលិក ឈ្មោះនាំចូល មូលហេតុ',
    },

    option: {
      allDerivedStatus: 'ស្ថានភាពគណនាទាំងអស់',
      allImportedStatus: 'ស្ថានភាពនាំចូលទាំងអស់',
      allShiftStatus: 'ស្ថានភាពវេនទាំងអស់',
      allDayTypes: 'ប្រភេទថ្ងៃទាំងអស់',
    },

    statusLabel: {
      processing: 'កំពុងដំណើរការ',
      success: 'ជោគជ័យ',
      partialSuccess: 'ជោគជ័យមួយផ្នែក',
      failed: 'បរាជ័យ',

      present: 'មានវត្តមាន',
      late: 'យឺត',
      absent: 'អវត្តមាន',
      forgetScanIn: 'ភ្លេចស្កេនចូល',
      forgetScanOut: 'ភ្លេចស្កេនចេញ',
      shiftMismatch: 'វេនមិនត្រឹមត្រូវ',
      leave: 'ឈប់សម្រាក',
      off: 'ថ្ងៃឈប់',
      unknown: 'មិនស្គាល់',

      valid: 'ត្រឹមត្រូវ',
      imported: 'បាននាំចូល',
      error: 'កំហុស',
      invalid: 'មិនត្រឹមត្រូវ',
      warning: 'ព្រមាន',
      duplicate: 'ស្ទួន',
      pending: 'កំពុងរង់ចាំ',
      cancelled: 'បានបោះបង់',
      draft: 'ព្រាង',

      matched: 'ផ្គូផ្គង',
      mismatch: 'មិនផ្គូផ្គង',

      workingDay: 'ថ្ងៃធ្វើការ',
      sunday: 'ថ្ងៃអាទិត្យ',
      holiday: 'ថ្ងៃឈប់សម្រាក',
      missing: 'បាត់',
    },

    message: {
      loadFailed: 'ផ្ទុកមិនបាន',
      detailLoadFailed: 'ផ្ទុកព័ត៌មានលម្អិតមិនបាន',
      missingImportId: 'បាត់ Import ID',
      missingImportIdDetail: 'មិនអាចបើកព័ត៌មានលម្អិតការនាំចូលនេះបាន ព្រោះ ID បាត់។',
      noDataFound: 'រកមិនឃើញទិន្នន័យ',
      updating: 'កំពុងធ្វើបច្ចុប្បន្នភាព',
      failedRowsWarning: 'មានជួរមួយចំនួនបរាជ័យ ឬត្រូវបានរំលង។ សូមពិនិត្យបញ្ជីជួរបរាជ័យខាងក្រោម។',
      partialImportWarning: 'វត្តមានត្រូវបាននាំចូលដោយមានជួរមួយចំនួនត្រូវបានរំលង ស្ទួន ឬមិនត្រឹមត្រូវ។',
    },

    verification: {
      otDate: 'កាលបរិច្ឆេទ OT',
      selectOtDate: 'ជ្រើសកាលបរិច្ឆេទ OT',
      searchOtRequest: 'ស្វែងរកសំណើ OT',
      selectOtRequest: 'ជ្រើសសំណើ OT',
      requestStatus: 'ស្ថានភាពសំណើ',

      allResults: 'លទ្ធផលទាំងអស់',
      matched: 'ផ្គូផ្គង',
      acceptedByPolicy: 'ទទួលយកដោយគោលការណ៍',
      needsCheck: 'ត្រូវពិនិត្យ',
      forgetScanIn: 'ភ្លេចស្កេនចូល',
      forgetScanOut: 'ភ្លេចស្កេនចេញ',
      otStaffAbsent: 'បុគ្គលិក OT អវត្តមាន',
      wrongShift: 'វេនខុស',
      notInOtStaff: 'មិននៅក្នុងបុគ្គលិក OT',
      notEligible: 'មិនមានសិទ្ធិ',

      requestStaff: 'បុគ្គលិកសំណើ',
      forgetIn: 'ភ្លេចចូល',
      forgetOut: 'ភ្លេចចេញ',
      absent: 'អវត្តមាន',
      notInOt: 'មិននៅក្នុង OT',

      nonFinalWarning:
        'សំណើ OT នេះកំពុងមានស្ថានភាព {status}។ អ្នកអាចផ្ទៀងផ្ទាត់សម្រាប់ពិនិត្យ ប៉ុន្តែការទូទាត់ OT ចុងក្រោយគួរតែផ្អែកលើសំណើដែលបានអនុម័តចុងក្រោយ។',

      requestNo: 'លេខសំណើ',
      requester: 'អ្នកស្នើ',
      shift: 'វេន',
      expectedOt: 'OT រំពឹងទុក',
      requested: 'បានស្នើ',
      policy: 'គោលការណ៍',

      verificationResult: 'លទ្ធផលផ្ទៀងផ្ទាត់',
      loadingVerification: 'កំពុងផ្ទុកការផ្ទៀងផ្ទាត់វត្តមាន OT...',
      rowCount: '{count} ជួរ',
      searchPlaceholder: 'ស្វែងរកបុគ្គលិក/លទ្ធផល/មូលហេតុ',
      result: 'លទ្ធផល',
      meaning: 'អត្ថន័យ',
      employee: 'បុគ្គលិក',
      otType: 'ប្រភេទ OT',
      scanIn: 'ស្កេនចូល',
      scanOut: 'ស្កេនចេញ',
      status: 'ស្ថានភាព',
      creditedOt: 'OT ដែលបានគិត',
      actual: 'ជាក់ស្តែង',
      reason: 'មូលហេតុ',

      fixedOt: 'OT ថេរ',
      afterShift: 'ក្រោយវេន',
      otOption: 'ជម្រើស OT',

      noVerificationRows: 'រកមិនឃើញជួរផ្ទៀងផ្ទាត់។',
      emptyInstruction: 'ជ្រើសកាលបរិច្ឆេទ OT ជ្រើសសំណើ OT បន្ទាប់មកផ្ទៀងផ្ទាត់លទ្ធផលវត្តមាន។',

      otDateRequired: 'ត្រូវការកាលបរិច្ឆេទ OT',
      otDateRequiredDetail: 'សូមជ្រើសកាលបរិច្ឆេទ OT ជាមុន។',
      noOtRequests: 'គ្មានសំណើ OT',
      noOtRequestsDetail: 'រកមិនឃើញសំណើ OT សម្រាប់កាលបរិច្ឆេទ និងស្ថានភាពដែលបានជ្រើស។',
      loadFailed: 'ផ្ទុកមិនបាន',
      loadVerificationFailed: 'ផ្ទុកការផ្ទៀងផ្ទាត់វត្តមាន OT មិនបាន។',
      loadRequestsFailed: 'ផ្ទុកសំណើ OT មិនបាន។',

      noRequestNo: 'គ្មានលេខសំណើ',
      statusPrefix: 'ស្ថានភាព',
      staff: 'បុគ្គលិក',

      meaningLabel: {
        forgetScanIn: 'ភ្លេចស្កេនចូល',
        forgetScanOut: 'ភ្លេចស្កេនចេញ',
        acceptedByPolicy: 'ទទួលយកដោយគោលការណ៍',
        otStaffAbsent: 'បុគ្គលិក OT អវត្តមាន',
        wrongShift: 'វេនខុស',
        notInOtStaff: 'មិននៅក្នុងបុគ្គលិក OT',
        notEligible: 'មិនមានសិទ្ធិ OT',
        otMatchedRequest: 'OT ផ្គូផ្គងនឹងសំណើ',
        absent: 'អវត្តមាន',
        missingScanTime: 'បាត់ម៉ោងស្កេន',
        noCreditedOt: 'មិនមាន OT ដែលបានគិត',
        creditedLessThanRequest: 'OT ដែលបានគិតតិចជាងសំណើ',
        creditedOverRequest: 'OT ដែលបានគិតលើសសំណើ',
        adjustedByRule: 'បានកែតម្រូវដោយច្បាប់',
        checkOtRule: 'ពិនិត្យច្បាប់ OT',
      },
    },
  },

  ot: {
    common: {
      min: 'នាទី',
      minShort: 'ន',
      totalCount: 'សរុប {total}',
      hourValue: '{value}ម៉',
      minuteValue: '{value} នាទី',
      hourMinuteValue: '{hours}ម៉ {minutes}ន',
    },

    dayType: {
      workingDay: 'ថ្ងៃធ្វើការ',
      sunday: 'ថ្ងៃអាទិត្យ',
      holiday: 'ថ្ងៃឈប់សម្រាក',
    },

    status: {
      pending: 'កំពុងរង់ចាំ',
      pendingRequesterConfirmation: 'កំពុងរង់ចាំការបញ្ជាក់ពីអ្នកស្នើ',
      approved: 'បានអនុម័ត',
      rejected: 'បានបដិសេធ',
      requesterDisagreed: 'អ្នកស្នើមិនយល់ព្រម',
      cancelled: 'បានបោះបង់',
    },

    approval: {
      approvalStatus: 'ស្ថានភាពអនុម័ត',
      staffCount: 'បុគ្គលិក {count}',
      time: 'ម៉ោង',

      exportExcel: 'នាំចេញ Excel',
      approveSelected: 'អនុម័តដែលបានជ្រើស',
      approveSelectedWithCount: 'អនុម័តដែលបានជ្រើស ({count})',
      clearSelection: 'សម្អាតការជ្រើស',

      loading: 'កំពុងផ្ទុកប្រអប់អនុម័ត',
      fetchingRecords: 'កំពុងទាញយកសំណើអនុម័ត OT...',
      noData: 'រកមិនឃើញសំណើអនុម័ត OT។',
      loadFailed: 'ផ្ទុកប្រអប់អនុម័តមិនបាន។',

      exported: 'បានរៀបចំនាំចេញ',
      exportedSuccess: 'បាននាំចេញ Excel ដោយជោគជ័យ។',
      exportFailed: 'នាំចេញមិនបាន',

      requestedStaff: 'បុគ្គលិកដែលបានស្នើ',
      requested: 'សំណើ',
      breakTime: 'ម៉ោងសម្រាក',
      totalRequestPaid: 'សរុបសំណើដែលត្រូវបង់',
      paid: 'បានបង់',
      totalPaid: 'សរុបបានបង់',

      legacyManual: 'Manual ចាស់',
      shiftOption: 'ជម្រើសវេន',

      noSelectedRequests: 'គ្មានសំណើដែលបានជ្រើស',
      selectAtLeastOne: 'សូមជ្រើសសំណើ OT ដែលអាចអនុម័តបានយ៉ាងហោចណាស់មួយ។',

      decisionEyebrow: 'ការសម្រេចអនុម័ត OT',
      confirmApproval: 'បញ្ជាក់ការអនុម័ត',
      rejectRequest: 'បដិសេធសំណើ OT',
      approveQuestion: 'តើអ្នកប្រាកដថាចង់អនុម័តឬ?',
      rejectQuestion: 'តើអ្នកប្រាកដថាចង់បដិសេធឬ?',
      approveHelp: 'វានឹងអនុម័តបុគ្គលិកទាំងអស់ក្នុងសំណើ OT នេះ។',
      rejectHelp: 'វានឹងបដិសេធសំណើ OT ទាំងមូល។',

      remark: 'កំណត់សម្គាល់',
      optionalApprovalRemark: 'កំណត់សម្គាល់អនុម័ត បើមាន',
      rejectionReasonPlaceholder: 'សូមបញ្ចូលមូលហេតុបដិសេធ',
      rejectionRemarkRequired: 'សូមបញ្ចូលកំណត់សម្គាល់បដិសេធ។',
      yesApprove: 'បាទ/ចាស អនុម័ត',

      decisionSuccess: 'ជោគជ័យ',
      approveSuccess: 'បានដំណើរការសំណើ OT ដោយជោគជ័យ។',
      rejectSuccess: 'បានបដិសេធសំណើ OT ដោយជោគជ័យ។',
      decisionFailed: 'ការសម្រេចបរាជ័យ',

      bulkApproval: 'អនុម័តជាក្រុម',
      approveMultiple: 'អនុម័តសំណើ OT ច្រើន',
      requestCount: 'សំណើ {count}',
      bulkWarning:
        'តើអ្នកប្រាកដថាចង់អនុម័តសំណើ OT ដែលបានជ្រើសឬ? វានឹងអនុម័តបុគ្គលិកទាំងអស់ក្នុងសំណើនីមួយៗ។',
      bulkRemarkPlaceholder: 'កំណត់សម្គាល់សម្រាប់ការអនុម័តទាំងអស់ បើមាន',
      approveAllSelected: 'អនុម័តដែលបានជ្រើសទាំងអស់',

      bulkCompleted: 'ការអនុម័តជាក្រុមបានបញ្ចប់',
      bulkPartial: 'បានអនុម័ត {success}, បរាជ័យ {failed}។',
      bulkSuccess: 'បានអនុម័តសំណើ {count} ដោយជោគជ័យ។',
      bulkFailed: 'អនុម័តជាក្រុមមិនបានជោគជ័យ',
      bulkNoApproved: 'គ្មានសំណើណាមួយត្រូវបានអនុម័តទេ។',
    },

    requests: {
      title: 'សំណើ OT',
      createTitle: 'បង្កើតសំណើ OT',
      editTitle: 'កែប្រែសំណើ OT',
      detailTitle: 'ព័ត៌មានលម្អិតសំណើ OT',
      approvalTitle: 'ប្រអប់អនុម័ត OT',
      acknowledgeTitle: 'ប្រអប់ទទួលជ្រាប OT',
      subtitle: 'គ្រប់គ្រងសំណើម៉ោងបន្ថែមដោយប្រើទិន្នន័យពី backend។',

      requestNo: 'លេខសំណើ',
      otDate: 'កាលបរិច្ឆេទ OT',
      otTime: 'ម៉ោង OT',
      time: 'ម៉ោង',
      dayType: 'ប្រភេទថ្ងៃ',
      otOption: 'ជម្រើស OT',

      employee: 'បុគ្គលិក',
      employees: 'បុគ្គលិក',
      approver: 'អ្នកអនុម័ត',
      requester: 'អ្នកស្នើ',
      requestedMinutes: 'នាទីដែលបានស្នើ',
      paidMinutes: 'នាទីដែលត្រូវបង់',
      breakMinutes: 'នាទីសម្រាក',
      exportExcel: 'នាំចេញ Excel',
      newRequest: 'សំណើ OT ថ្មី',

      allDayTypes: 'ប្រភេទថ្ងៃទាំងអស់',
      otDateFrom: 'កាលបរិច្ឆេទ OT ចាប់ពី',
      otDateTo: 'កាលបរិច្ឆេទ OT ដល់',

      loading: 'កំពុងផ្ទុកសំណើ OT',
      fetchingRecords: 'កំពុងទាញយកកំណត់ត្រាសំណើ OT...',
      noData: 'រកមិនឃើញសំណើ OT។',
      loadFailed: 'ផ្ទុកសំណើ OT មិនបាន។',

      exported: 'បានរៀបចំនាំចេញ',
      exportedSuccess: 'បានទាញយកឯកសារ Excel ដោយជោគជ័យ។',
      exportFailed: 'នាំចេញមិនបាន',

      approvalStatus: 'ស្ថានភាពអនុម័ត',
      staff: 'បុគ្គលិក',
      staffCount: 'បុគ្គលិក {count}',
      timing: 'ពេលវេលា',
      verify: 'ផ្ទៀងផ្ទាត់',

      preset: 'បានកំណត់ជាមុន',
      customFixed: 'ផ្ទាល់ខ្លួន',

      employeeOtTimeDetail: 'ព័ត៌មានលម្អិតម៉ោង OT បុគ្គលិក',
      defaultRequestTime: 'ម៉ោងសំណើលំនាំដើម',
      employeeId: 'ID',
      break: 'សម្រាក',
      total: 'សរុប',
      mode: 'របៀប',
      noEmployeeData: 'រកមិនឃើញទិន្នន័យបុគ្គលិកសម្រាប់សំណើនេះ។',

      timeMode: {
        default: 'លំនាំដើម',
        custom: 'ផ្ទាល់ខ្លួន',
      },

      acknowledge: {
        loading: 'កំពុងផ្ទុកប្រអប់ទទួលជ្រាប',
        fetchingRecords: 'កំពុងទាញយកសំណើ OT សម្រាប់ទទួលជ្រាប...',
        noData: 'រកមិនឃើញសំណើទទួលជ្រាប។',
        loadFailed: 'ផ្ទុកប្រអប់ទទួលជ្រាបមិនបាន។',

        acknowledgement: 'ការទទួលជ្រាប',
        requestStatus: 'ស្ថានភាពសំណើ',
        fyi: 'ជូនជ្រាប',
      },
    },

    policy: {
      tableTitle: 'គោលការណ៍គណនា OT',
      subtitle:
        'ច្បាប់គណនា OT ពី backend ដែលប្រើសម្រាប់ជម្រើស OT តាមវេន និងការផ្ទៀងផ្ទាត់ទូទាត់។',
      searchPlaceholder: 'ស្វែងរកកូដ ឈ្មោះ ឬការពិពណ៌នា',

      newPolicy: 'គោលការណ៍ថ្មី',
      createTitle: 'បង្កើតគោលការណ៍ OT',
      editTitle: 'កែប្រែគោលការណ៍ OT',

      policy: 'គោលការណ៍',
      rounding: 'ការបង្គត់',
      eligibility: 'លក្ខខណ្ឌសិទ្ធិ',
      behavior: 'ឥរិយាបថ',
      forgetScan: 'ភ្លេចស្កេន',

      allMethods: 'វិធីទាំងអស់',
      roundMethodLabel: 'វិធីបង្គត់',
      minEligible: 'អប្បបរមាមានសិទ្ធិ',
      roundUnit: 'ឯកតាបង្គត់',
      graceAfterShiftEnd: 'អនុគ្រោះក្រោយបញ្ចប់វេន',

      minEligibleShort: 'អប្បបរមា',
      graceShort: 'អនុគ្រោះ',
      everyUnit: 'រៀងរាល់ {unit}',

      codePlaceholder: 'ឧទាហរណ៍: POST_SHIFT_STD_30M',
      namePlaceholder: 'ឧទាហរណ៍: Post Shift Standard 30-Minute Ceiling',
      descriptionPlaceholder: 'កំណត់ចំណាំសម្រាប់ Admin បើមាន...',
      activeHelp: 'គោលការណ៍សកម្មអាចប្រើសម្រាប់ជម្រើស Shift OT ថ្មី។',

      loading: 'កំពុងផ្ទុកគោលការណ៍ OT',
      noData: 'គ្មានគោលការណ៍ OT ដែលត្រូវនឹងតម្រងរបស់អ្នកទេ។',
      loadFailed: 'ផ្ទុកគោលការណ៍ OT មិនបាន។',
      saveFailed: 'រក្សាទុកគោលការណ៍ OT មិនបាន។',
      createdSuccess: 'បានបង្កើតគោលការណ៍ OT ដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពគោលការណ៍ OT ដោយជោគជ័យ។',

      roundMethod: {
        floor: 'បង្គត់ចុះ',
        ceil: 'បង្គត់ឡើង',
        nearest: 'បង្គត់ជិតបំផុត',
      },

      flag: {
        allowPreShiftOT: 'មុនវេន',
        allowPostShiftOT: 'ក្រោយវេន',
        capByRequestedMinutes: 'កំណត់តាមសំណើ',
        treatForgetScanInAsPending: 'ខ្វះស្កេនចូល = រង់ចាំ',
        treatForgetScanOutAsPending: 'ខ្វះស្កេនចេញ = រង់ចាំ',
        allowApprovedOtWithoutExactClockOut: 'មិនចាំបាច់មានម៉ោងចេញជាក់លាក់',
      },

      flagHelp: {
        allowPreShiftOT: 'អនុញ្ញាត OT មុនម៉ោងចាប់ផ្តើមវេន។',
        allowPostShiftOT: 'អនុញ្ញាត OT ក្រោយម៉ោងបញ្ចប់វេន។',
        capByRequestedMinutes: 'មិនបង់លើស OT ដែលបានស្នើ។',
        treatForgetScanInAsPending: 'ត្រូវការពិនិត្យ ពេលខ្វះម៉ោងស្កេនចូល។',
        treatForgetScanOutAsPending: 'ត្រូវការពិនិត្យ ពេលខ្វះម៉ោងស្កេនចេញ។',
        allowApprovedOtWithoutExactClockOut:
          'អនុញ្ញាត OT ដែលបានអនុម័តដោយគ្មានម៉ោងចេញជាក់លាក់ ពេលគោលការណ៍អនុញ្ញាត។',
      },

      flagShort: {
        pre: 'មុន {value}',
        post: 'ក្រោយ {value}',
        cap: 'កំណត់ {value}',
        noExactOut: 'គ្មានចេញជាក់លាក់ {value}',
        fsIn: 'FS ចូល {value}',
        fsOut: 'FS ចេញ {value}',
      },

      validation: {
        codeRequired: 'ត្រូវការកូដ។',
        nameRequired: 'ត្រូវការឈ្មោះ។',
        roundMethodRequired: 'ត្រូវការវិធីបង្គត់។',
        roundUnitInvalid: 'ឯកតាបង្គត់ត្រូវយ៉ាងហោចណាស់ 1 នាទី។',
        minEligibleInvalid: 'អប្បបរមានាទីមានសិទ្ធិមិនអាចអវិជ្ជមានបានទេ។',
        graceInvalid: 'នាទីអនុគ្រោះមិនអាចអវិជ្ជមានបានទេ។',
      },
    },

    shiftOption: {
      tableTitle: 'ជម្រើស OT តាមវេន',
      subtitle:
        'គ្រប់គ្រងជម្រើស OT តាមវេន ប្រភេទថ្ងៃ របៀបពេលវេលា និងគោលការណ៍គណនា។',
      searchPlaceholder: 'ស្វែងរកវេន ស្លាកជម្រើស គោលការណ៍ ឬរបៀបពេលវេលា',

      newOption: 'ជម្រើសថ្មី',
      createTitle: 'បង្កើតជម្រើស Shift OT',
      editTitle: 'កែប្រែជម្រើស Shift OT',

      allShifts: 'វេនទាំងអស់',
      allPolicies: 'គោលការណ៍ទាំងអស់',
      allTimingModes: 'របៀបពេលវេលាទាំងអស់',
      allDayTypes: 'ប្រភេទថ្ងៃទាំងអស់',

      optionLabel: 'ស្លាកជម្រើស',
      dayType: 'ប្រភេទថ្ងៃ',
      timingMode: 'របៀបពេលវេលា',
      otWindow: 'ចន្លោះ OT',
      requested: 'បានស្នើ',
      break: 'សម្រាក',
      paid: 'បានបង់',
      policy: 'គោលការណ៍គណនា',
      sequence: 'លំដាប់',

      selectShift: 'ជ្រើសវេន',
      selectPolicy: 'ជ្រើសគោលការណ៍គណនា',
      labelPlaceholder: 'ឧទាហរណ៍: Evening OT 18:00 - 20:00',

      applicableDayTypes: 'ប្រភេទថ្ងៃដែលអនុវត្ត',
      selectDayTypes: 'ជ្រើសប្រភេទថ្ងៃ',
      startAfterShiftEnd: 'ចាប់ផ្តើមក្រោយបញ្ចប់វេន',
      startAfterShiftEndHelp:
        'Backend ប្រើម៉ោងបញ្ចប់វេនដែលបានជ្រើស បូក offset នេះ ដើម្បីបង្កើតចន្លោះ OT។',
      requestedMinutes: 'នាទីដែលបានស្នើ',
      fixedStartTime: 'ម៉ោងចាប់ផ្តើមថេរ',
      fixedEndTime: 'ម៉ោងបញ្ចប់ថេរ',
      activeHelp: 'ជម្រើសអសកម្មនឹងមិនអាចជ្រើសសម្រាប់សំណើ OT ថ្មីបានទេ។',

      timing: {
        afterShiftEnd: 'ក្រោយបញ្ចប់វេន',
        fixedTime: 'ម៉ោងថេរ',
      },

      afterShiftOffset: 'Offset {offset} ក្រោយបញ្ចប់វេន',
      roundEvery: 'បង្គត់រៀងរាល់ {unit}',
      minEligibleValue: 'អប្បបរមា {value}',

      noData: 'គ្មានជម្រើស Shift OT ដែលត្រូវនឹងតម្រងរបស់អ្នកទេ។',
      loadFailed: 'ផ្ទុកជម្រើស Shift OT មិនបាន។',
      saveFailed: 'រក្សាទុកជម្រើស Shift OT មិនបាន។',
      createdSuccess: 'បានបង្កើតជម្រើស Shift OT ដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពជម្រើស Shift OT ដោយជោគជ័យ។',
      shiftLookupFailed: 'ផ្ទុកជម្រើសវេនមិនបាន។',
      policyLookupFailed: 'ផ្ទុកជម្រើសគោលការណ៍មិនបាន។',

      validation: {
        shiftRequired: 'ត្រូវការវេន។',
        labelRequired: 'ត្រូវការស្លាកជម្រើស។',
        timingModeRequired: 'ត្រូវការរបៀបពេលវេលា។',
        dayTypesRequired: 'សូមជ្រើសប្រភេទថ្ងៃយ៉ាងហោចណាស់មួយ។',
        policyRequired: 'ត្រូវការគោលការណ៍គណនា។',
        requestedMinutesInvalid: 'នាទីដែលបានស្នើត្រូវយ៉ាងហោចណាស់ 1។',
        sequenceInvalid: 'លំដាប់ត្រូវយ៉ាងហោចណាស់ 1។',
        startAfterShiftEndInvalid: 'នាទីចាប់ផ្តើមក្រោយបញ្ចប់វេន មិនអាចអវិជ្ជមានបានទេ។',
        fixedStartTimeInvalid: 'ម៉ោងចាប់ផ្តើមថេរត្រូវប្រើទម្រង់ HH:mm។',
        fixedEndTimeInvalid: 'ម៉ោងបញ្ចប់ថេរត្រូវប្រើទម្រង់ HH:mm។',
        fixedTimeSame: 'ម៉ោងចាប់ផ្តើមថេរ និងម៉ោងបញ្ចប់ថេរ មិនអាចដូចគ្នាបានទេ។',
      },
    },
  },

  payment: {
    title: 'ការទូទាត់',
    processTitle: 'ដំណើរការទូទាត់',
    formulasTitle: 'រូបមន្តទូទាត់',
    preview: 'មើលជាមុន',
    calculateExport: 'គណនា និងនាំចេញ',
    salaryTemplate: 'គំរូប្រាក់ខែ',

    dayTypes: {
      workingDay: 'ថ្ងៃធ្វើការ',
      sunday: 'ថ្ងៃអាទិត្យ',
      holiday: 'ថ្ងៃឈប់សម្រាក',
    },

    formulas: {
      tableTitle: 'បញ្ជីរូបមន្តទូទាត់',
      searchPlaceholder: 'ស្វែងរកកូដ ឈ្មោះ ឬការពិពណ៌នា',

      newFormula: 'រូបមន្តថ្មី',
      createTitle: 'បង្កើតរូបមន្តទូទាត់',
      editTitle: 'កែប្រែរូបមន្តទូទាត់',

      formulaName: 'ឈ្មោះរូបមន្ត',
      baseRule: 'ច្បាប់មូលដ្ឋាន',
      multipliers: 'មេគុណ',
      round: 'បង្គត់',
      currency: 'រូបិយប័ណ្ណ',

      daysPerMonth: 'ថ្ងៃ / ខែ',
      hoursPerDay: 'ម៉ោង / ថ្ងៃ',
      hoursPerDayField: 'ម៉ោង / ថ្ងៃ',
      decimals: 'ខ្ទង់ទសភាគ',

      workingDays: 'ថ្ងៃធ្វើការ',
      roundDecimals: 'បង្គត់ខ្ទង់ទសភាគ',
      dayTypeMultipliers: 'មេគុណតាមប្រភេទថ្ងៃ',
      previewTitle: 'មើលរូបមន្តជាមុន',

      codePlaceholder: 'ឧទាហរណ៍: STD_OT_2026',
      namePlaceholder: 'ឧទាហរណ៍: Standard OT Formula 2026',
      descriptionPlaceholder: 'ការពិពណ៌នា បើមាន...',

      dialogNote:
        'ការកំណត់រូបមន្តត្រូវបានរក្សាទុក។ Excel ប្រាក់ខែ និងលទ្ធផលទូទាត់ដែលបានបង្កើត មិនត្រូវបានរក្សាទុកទេ។',

      hourlyRatePreview:
        'អត្រាម៉ោង = ប្រាក់ខែប្រចាំខែ ÷ ថ្ងៃធ្វើការ ÷ ម៉ោងក្នុងមួយថ្ងៃ',
      otAmountPreview:
        'ចំនួនប្រាក់ OT = ម៉ោង OT ដែលត្រូវបង់ × អត្រាម៉ោង × មេគុណប្រភេទថ្ងៃ',

      noData: 'គ្មានរូបមន្តទូទាត់ដែលត្រូវនឹងតម្រងរបស់អ្នកទេ។',
      loadFailed: 'ផ្ទុករូបមន្តទូទាត់មិនបាន។',
      saveFailed: 'រក្សាទុករូបមន្តទូទាត់មិនបាន។',
      createdSuccess: 'បានបង្កើតរូបមន្តទូទាត់ដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពរូបមន្តទូទាត់ដោយជោគជ័យ។',

      validation: {
        codeRequired: 'ត្រូវការកូដ។',
        nameRequired: 'ត្រូវការឈ្មោះ។',
        workingDaysRequired: 'ថ្ងៃធ្វើការប្រចាំខែត្រូវធំជាង 0។',
        hoursPerDayRequired: 'ម៉ោងក្នុងមួយថ្ងៃត្រូវធំជាង 0។',
        workingDayMultiplierInvalid: 'មេគុណថ្ងៃធ្វើការមិនអាចអវិជ្ជមានបានទេ។',
        sundayMultiplierInvalid: 'មេគុណថ្ងៃអាទិត្យមិនអាចអវិជ្ជមានបានទេ។',
        holidayMultiplierInvalid: 'មេគុណថ្ងៃឈប់សម្រាកមិនអាចអវិជ្ជមានបានទេ។',
        roundingInvalid: 'ខ្ទង់ទសភាគសម្រាប់បង្គត់ត្រូវស្ថិតនៅចន្លោះ 0 ដល់ 6។',
      },
    },

    process: {
      field: {
        paymentFormula: 'រូបមន្តទូទាត់',
        salaryExcel: 'Excel ប្រាក់ខែ',
        noFile: 'មិនទាន់ជ្រើសឯកសារ',
        formula: 'រូបមន្ត',
        workingDays: 'ថ្ងៃធ្វើការ',
        hoursPerDay: 'ម៉ោងក្នុងមួយថ្ងៃ',
        month: 'ខែ',
        hours: 'ម៉ោង',
        multipliers: 'មេគុណ',
        calculation: 'ការគណនា',
      },

      action: {
        uploadSalary: 'ផ្ទុកឡើងប្រាក់ខែ',
        changeFile: 'ប្តូរឯកសារ',
        template: 'គំរូ',
        preview: 'មើលជាមុន',
        generate: 'បង្កើត',
      },

      card: {
        processingTitle: 'ដំណើរការទូទាត់',
        processingSubtitle: 'មើលជាមុនសិន បន្ទាប់មកបង្កើត Excel ទូទាត់ OT ចុងក្រោយ។',
        formulaTitle: 'មើលរូបមន្តជាមុន',
        formulaSubtitle: 'រូបមន្តដែលបានជ្រើសសម្រាប់ការគណនាទូទាត់នេះ។',
      },

      status: {
        previewReady: 'មើលជាមុនរួចរាល់',
        notPreviewed: 'មិនទាន់មើលជាមុន',
        ready: 'រួចរាល់',
        selectFormula: 'ជ្រើសរូបមន្ត',
      },

      note: {
        notSaved:
          'ឯកសារប្រាក់ខែ លទ្ធផលមើលជាមុន និងឯកសារទូទាត់ចុងក្រោយ មិនត្រូវបានរក្សាទុកទេ។ ប្រសិនបើទាញយកបរាជ័យ សូមផ្ទុកឡើងប្រាក់ខែម្តងទៀត ហើយបង្កើតម្តងទៀត។',
      },

      calendar: {
        title: 'ពិនិត្យប្រតិទិនខាងក្នុង',
        subtitle:
          'Frontend បង្ហាញថ្ងៃឈប់សម្រាកសកម្មពីម៉ូឌុលប្រតិទិន។ Backend payment នៅតែគណនាប្រភេទថ្ងៃផ្លូវការឡើងវិញ។',
        loading: 'កំពុងផ្ទុកប្រតិទិន',
        holidayCount: 'ថ្ងៃឈប់សម្រាក {count}',
        workingDays: 'ថ្ងៃធ្វើការ',
        sundays: 'ថ្ងៃអាទិត្យ',
        internalHolidays: 'ថ្ងៃឈប់សម្រាកខាងក្នុង',
      },

      preview: {
        title: 'មើលការទូទាត់ជាមុន',
        subtitle: 'ពិនិត្យលទ្ធផលដែលបានគណនា មុនបង្កើត Excel។',
        notSaved: 'ជួរមើលជាមុនមិនត្រូវបានរក្សាទុកក្នុង database ទេ។',
      },

      summary: {
        payableEmployees: 'បុគ្គលិកដែលត្រូវបង់',
        totalOtHours: 'ម៉ោង OT សរុប',
        totalAmount: 'ចំនួនប្រាក់សរុប',
        missingSalary: 'ខ្វះប្រាក់ខែ',
        warnings: 'ការព្រមាន',
      },

      table: {
        detail: 'ព័ត៌មានលម្អិតមើលការទូទាត់ជាមុន',
        missingSalary: 'ខ្វះប្រាក់ខែ',
        warnings: 'ការព្រមាន',
      },

      column: {
        requestNo: 'លេខសំណើ',
        otOption: 'ជម្រើស OT',
        otTime: 'ម៉ោង OT',
        paymentDayType: 'ប្រភេទថ្ងៃទូទាត់',
        internalCalendar: 'ប្រតិទិនខាងក្នុង',
        storedType: 'ប្រភេទដែលបានរក្សាទុក',
        employeeId: 'ID',
        employeeName: 'ឈ្មោះ',
        salary: 'ប្រាក់ខែ',
        otOptionTime: 'ម៉ោងជម្រើស OT',
        breakTime: 'ម៉ោងសម្រាក',
        totalRequestPaid: 'សរុបសំណើដែលត្រូវបង់',
        actual: 'ជាក់ស្តែង',
        eligible: 'មានសិទ្ធិ',
        payable: 'ត្រូវបង់',
        backendCap: 'កំណត់ដោយ Backend',
        hours: 'ម៉ោង',
        multiplier: 'មេគុណ',
        amount: 'ចំនួនប្រាក់',
        currency: 'រូបិយប័ណ្ណ',
        decision: 'ការសម្រេច',
        reason: 'មូលហេតុ',
        otHours: 'ម៉ោង OT',
      },

      label: {
        cappedByRequestPaid: 'កំណត់តាមសំណើដែលត្រូវបង់',
        backendCalculated: 'គណនាដោយ Backend',
      },

      empty: {
        noFormula: 'មិនទាន់ជ្រើសរូបមន្ត',
        selectFormula: 'សូមជ្រើសរូបមន្តទូទាត់សកម្មមុនមើលជាមុន។',
        noPaymentDetail: 'រកមិនឃើញព័ត៌មានលម្អិតការទូទាត់ដែលត្រូវបង់។',
        noMissingSalary: 'គ្មានប្រាក់ខែខ្វះ។',
        noWarnings: 'គ្មានការព្រមាន។',
        previewTitle: 'មិនទាន់មានការមើលទូទាត់ជាមុន',
        previewHint:
          'ផ្ទុកឡើង Excel ប្រាក់ខែ ហើយចុច មើលជាមុន ដើម្បីមើលលទ្ធផលទូទាត់ មុនទាញយក។',
      },

      validation: {
        fromDateRequired: 'ត្រូវការថ្ងៃចាប់ពី។',
        toDateRequired: 'ត្រូវការថ្ងៃដល់។',
        formulaRequired: 'ត្រូវការរូបមន្តទូទាត់។',
        salaryRequired: 'ត្រូវការឯកសារ Excel ប្រាក់ខែ។',
        invalidDateRange: 'ថ្ងៃចាប់ពីមិនអាចនៅក្រោយថ្ងៃដល់បានទេ។',
      },

      message: {
        loadFormulasFailed: 'ផ្ទុករូបមន្តទូទាត់មិនបាន។',
        calendarFailedTitle: 'ប្រតិទិនបរាជ័យ',
        calendarFailed: 'ផ្ទុកប្រតិទិនថ្ងៃឈប់សម្រាកខាងក្នុងមិនបាន។',

        invalidFileTitle: 'ឯកសារមិនត្រឹមត្រូវ',
        invalidFile: 'សូមផ្ទុកឡើងតែឯកសារ Excel: .xlsx ឬ .xls។',

        downloadedTitle: 'បានទាញយក',
        downloadFailedTitle: 'ទាញយកមិនបាន',
        templateDownloaded: 'បានទាញយកគំរូប្រាក់ខែ។',
        templateDownloadFailed: 'ទាញយកគំរូប្រាក់ខែមិនបាន។',

        checkFormTitle: 'ពិនិត្យទម្រង់',

        previewReadyTitle: 'មើលជាមុនរួចរាល់',
        previewReady: 'បានគណនាការមើលទូទាត់ជាមុនដោយជោគជ័យ។',
        previewFailedTitle: 'មើលជាមុនមិនបាន',
        previewFailed: 'គណនាការមើលទូទាត់ជាមុនមិនបាន។',

        previewRequiredTitle: 'ត្រូវមើលជាមុន',
        previewRequired: 'សូមមើលការទូទាត់ជាមុន មុនបង្កើត Excel។',

        generatedTitle: 'បានបង្កើត',
        generated: 'បានបង្កើត Excel ទូទាត់ដោយជោគជ័យ។',
        generateFailedTitle: 'បង្កើតមិនបាន',
        generateFailed: 'បង្កើត Excel ទូទាត់មិនបាន។',
      },
    },
  },
}