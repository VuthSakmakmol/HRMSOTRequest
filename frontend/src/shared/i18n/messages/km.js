// frontend/src/shared/i18n/messages/km.js

export default {
  common: {
    appName: 'សំណើ OT',

    loading: 'កំពុងផ្ទុក',
    updating: 'កំពុងធ្វើបច្ចុប្បន្នភាព',
    search: 'ស្វែងរក',
    refresh: 'ផ្ទុកឡើងវិញ',
    clear: 'សម្អាត',
    selectAll: 'ជ្រើសទាំងអស់',
    export: 'នាំចេញ',
    import: 'នាំចូល',
    download: 'ទាញយក',
    create: 'បង្កើត',
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
    edit: 'កែប្រែ',
    back: 'ត្រឡប់ក្រោយ',

    no: 'ទេ',
    yes: 'បាទ/ចាស',
    none: 'គ្មាន',
    unknown: 'មិនស្គាល់',
    warning: 'ការព្រមាន',
    thisData: 'ទិន្នន័យនេះ',

    status: 'ស្ថានភាព',
    allStatus: 'ស្ថានភាពទាំងអស់',
    active: 'សកម្ម',
    inactive: 'មិនសកម្ម',

    fromDate: 'ចាប់ពីថ្ងៃ',
    toDate: 'ដល់ថ្ងៃ',
    date: 'កាលបរិច្ឆេទ',
    name: 'ឈ្មោះ',
    code: 'កូដ',
    description: 'ការពិពណ៌នា',
    createdAt: 'បានបង្កើតនៅ',
    updatedAt: 'បានធ្វើបច្ចុប្បន្នភាពនៅ',

    loaded: 'បានផ្ទុក {loaded} ក្នុងចំណោម {total}',
    noData: 'រកមិនឃើញទិន្នន័យ',
    somethingWentWrong: 'មានបញ្ហាកើតឡើង',
    loadFailed: 'ផ្ទុកមិនបានសម្រេច',
    createFailed: 'បង្កើតមិនបានសម្រេច',
    updateFailed: 'ធ្វើបច្ចុប្បន្នភាពមិនបានសម្រេច',
    saveFailed: 'រក្សាទុកមិនបានសម្រេច',
    downloadFailed: 'ទាញយកមិនបានសម្រេច',
    created: 'បានបង្កើត',
    updated: 'បានធ្វើបច្ចុប្បន្នភាព',
    deleted: 'បានលុប',
    deleteFailed: 'លុបមិនបានសម្រេច',
    downloaded: 'បានទាញយក',
    loadingData: 'កំពុងផ្ទុកទិន្នន័យ',
    fetchingRecords: 'កំពុងទាញយកទិន្នន័យពីម៉ាស៊ីនមេ។',

    noPermission: 'គ្មានសិទ្ធិ',
    openNavigation: 'បើកម៉ឺនុយ',
    toggleDesktopSidebar: 'បើក/បិទ Sidebar',
    toggleTheme: 'ប្ដូរ Theme',
    switchToLightMode: 'ប្ដូរទៅ Light Mode',
    switchToDarkMode: 'ប្ដូរទៅ Dark Mode',
    notifications: 'ការជូនដំណឹង',
    language: 'ភាសា',

    statusValue: {
      active: 'សកម្ម',
      inactive: 'មិនសកម្ម',
      unknown: 'មិនស្គាល់',
    },

    error: {
      internalServerError: 'មានបញ្ហាខាងម៉ាស៊ីនមេ។',
      validationError: 'ទិន្នន័យមិនត្រឹមត្រូវ។',
      invalidId: 'លេខសម្គាល់មិនត្រឹមត្រូវ។',
      notFound: 'រកមិនឃើញ។',
      routeNotFound: 'រកមិនឃើញផ្លូវ API។',
      duplicateRecord: 'ទិន្នន័យស្ទួន។',
      checkRequiredFields: 'សូមពិនិត្យវាលដែលត្រូវបំពេញ។',
      duplicateOrConflict:
        'ទិន្នន័យនេះមានរួចហើយ ឬប៉ះទង្គិចជាមួយទិន្នន័យផ្សេង។',
      missingPermissionWithSubject:
        'មិនអាចផ្ទុក {subject} បានទេ ព្រោះគណនីអ្នកខ្វះសិទ្ធិ៖ {permission}។',
      missingPermissionForSubject:
        'មិនអាចផ្ទុក {subject} បានទេ ព្រោះគណនីអ្នកមិនមានសិទ្ធិគ្រប់គ្រាន់។',
      saveMissingPermission:
        'អ្នកមិនអាចរក្សាទុកទិន្នន័យនេះបានទេ ព្រោះគណនីអ្នកខ្វះសិទ្ធិ៖ {permission}។',
      saveNoPermission: 'អ្នកមិនមានសិទ្ធិរក្សាទុកទិន្នន័យនេះទេ។',
    },

    validation: {
      invalidId: 'លេខសម្គាល់មិនត្រឹមត្រូវ។',
      idRequired: 'ត្រូវការលេខសម្គាល់។',
      tooLong: 'តម្លៃវែងពេក។',
      dateInvalid: 'កាលបរិច្ឆេទមិនត្រឹមត្រូវ។',
      timeRequired: 'ត្រូវការពេលវេលា។',
      timeInvalid: 'ពេលវេលាត្រូវតែមានទម្រង់ HH:mm។',
      pageInvalid: 'ទំព័រមិនត្រឹមត្រូវ។',
      limitInvalid: 'ចំនួនកំណត់មិនត្រឹមត្រូវ។',
      searchTooLong: 'ពាក្យស្វែងរកវែងពេក។',
      sortFieldInvalid: 'វាលតម្រៀបមិនត្រឹមត្រូវ។',
    },
  },

  validation: {
    field: {
      invalid: 'តម្លៃមិនត្រឹមត្រូវ។',
    },
    id: {
      invalid: 'លេខសម្គាល់មិនត្រឹមត្រូវ។',
    },
    page: {
      invalid: 'ទំព័រមិនត្រឹមត្រូវ។',
    },
    limit: {
      invalid: 'ចំនួនកំណត់មិនត្រឹមត្រូវ។',
    },
    search: {
      invalid: 'តម្លៃស្វែងរកមិនត្រឹមត្រូវ។',
    },
    isActive: {
      invalid: 'ស្ថានភាពមិនត្រឹមត្រូវ។',
    },
    sortField: {
      invalid: 'វាលតម្រៀបមិនត្រឹមត្រូវ។',
    },
    sortOrder: {
      invalid: 'លំដាប់តម្រៀបមិនត្រឹមត្រូវ។',
    },
  },
  profile: {
    unknownUser: 'អ្នកប្រើ',
    accountInformation: 'ព័ត៌មានគណនី',
    displayName: 'ឈ្មោះបង្ហាញ',
    loginId: 'Login ID',
    employee: 'បុគ្គលិក',
    department: 'ផ្នែក',
    position: 'មុខតំណែង',
  },
  auth: {
    login: 'ចូលប្រើ',
    logout: 'ចេញពីប្រព័ន្ធ',
    username: 'ឈ្មោះអ្នកប្រើ',
    loginId: 'Login ID',
    password: 'ពាក្យសម្ងាត់',
    profile: 'ប្រវត្តិរូប',

    accessDenied: 'មិនអនុញ្ញាតឱ្យចូលប្រើ',
    noPermission: 'អ្នកមិនមានសិទ្ធិចូលប្រើទំព័រនេះទេ។',

    loginSubtitle: 'ចូលប្រើដោយគណនីក្រុមហ៊ុនរបស់អ្នក ដើម្បីបន្ត។',
    loginIdPlaceholder: 'បញ្ចូល Login ID',
    passwordPlaceholder: 'បញ្ចូលពាក្យសម្ងាត់',
    signingIn: 'កំពុងចូលប្រើ...',

    validation: {
      loginIdRequired: 'ត្រូវការ Login ID។',
      passwordRequired: 'ត្រូវការពាក្យសម្ងាត់។',
    },

    error: {
      loginFailed: 'ចូលប្រើមិនបានសម្រេច។ សូមព្យាយាមម្តងទៀត។',
      invalidCredentials: 'Login ID ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ។',
      unauthorized: 'មិនមានការអនុញ្ញាត។ សូមចូលប្រើម្ដងទៀត។',
      sessionExpired: 'Session បានផុតកំណត់។ សូមចូលប្រើម្ដងទៀត។',
      invalidToken: 'Token មិនត្រឹមត្រូវ ឬផុតកំណត់។',
      employeeLinkRequired:
        'គណនីចូលប្រើរបស់អ្នកមិនទាន់ភ្ជាប់ជាមួយប្រវត្តិបុគ្គលិកទេ។',
    },

    account: {
      tableTitle: 'បញ្ជីគណនី',
      tableSubtitle: 'បញ្ជីគណនីប្រើ server-side lazy loading។',

      newAccount: 'គណនីថ្មី',
      createTitle: 'បង្កើតគណនី',
      editTitle: 'កែប្រែគណនី',

      searchPlaceholder:
        'ស្វែងរក Login ID, ឈ្មោះ, បុគ្គលិក, តួនាទី ឬសិទ្ធិ',

      noData: 'គ្មានគណនីត្រូវនឹងលក្ខខណ្ឌស្វែងរក។',
      loadFailed: 'ផ្ទុកគណនីមិនបានសម្រេច។',

      displayName: 'ឈ្មោះបង្ហាញ',
      directPermissions: 'សិទ្ធិផ្ទាល់',
      mustChangePassword: 'ត្រូវប្ដូរពាក្យសម្ងាត់',

      selectEmployee: 'ជ្រើសបុគ្គលិក',
      selectRoles: 'ជ្រើសតួនាទី',

      directPermissionHelp: 'បំបែកកូដសិទ្ធិដោយសញ្ញាក្បៀស។',
      directPermissionPlaceholder: 'ACCOUNT_VIEW, ACCOUNT_CREATE',

      loginIdExample: 'ឧទាហរណ៍៖ john.smith',
      displayNameExample: 'ឧទាហរណ៍៖ John Smith',

      unnamedEmployee: 'បុគ្គលិកគ្មានឈ្មោះ',
      unnamedRole: 'តួនាទីគ្មានឈ្មោះ',

      employeeOptionsLoadFailed: 'ផ្ទុកជម្រើសបុគ្គលិកមិនបានសម្រេច។',
      roleOptionsLoadFailed: 'ផ្ទុកជម្រើសតួនាទីមិនបានសម្រេច។',

      createdSuccess: 'បានបង្កើតគណនីដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពគណនីដោយជោគជ័យ។',
      createFailed: 'បង្កើតគណនីមិនបានសម្រេច។',
      updateFailed: 'ធ្វើបច្ចុប្បន្នភាពគណនីមិនបានសម្រេច។',

      reset: 'កំណត់ឡើងវិញ',
      resetPassword: 'កំណត់ពាក្យសម្ងាត់ឡើងវិញ',
      newPassword: 'ពាក្យសម្ងាត់ថ្មី',
      forcePasswordChange: 'បង្ខំឱ្យប្ដូរពាក្យសម្ងាត់បន្ទាប់ពីកំណត់ឡើងវិញ',
      resettingFor: 'កំពុងកំណត់ពាក្យសម្ងាត់ឡើងវិញសម្រាប់',
      passwordReset: 'បានកំណត់ពាក្យសម្ងាត់ឡើងវិញ',
      passwordResetSuccess: 'បានកំណត់ពាក្យសម្ងាត់ឡើងវិញដោយជោគជ័យ។',
      resetFailed: 'កំណត់ពាក្យសម្ងាត់ឡើងវិញមិនបានសម្រេច។',

      validation: {
        loginIdRequired: 'ត្រូវការ Login ID។',
        loginIdTooLong: 'Login ID វែងពេក។',
        displayNameRequired: 'ត្រូវការឈ្មោះបង្ហាញ។',
        passwordMinLength: 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច 6 តួអក្សរ។',
        passwordMaxLength: 'ពាក្យសម្ងាត់មិនត្រូវលើស 100 តួអក្សរ។',
      },

      error: {
        notFound: 'រកមិនឃើញគណនី។',
        loginIdExists: 'Login ID មានរួចហើយ។',
      },

      success: {
        passwordReset: 'បានកំណត់ពាក្យសម្ងាត់ឡើងវិញដោយជោគជ័យ។',
      },
    },
  },

  nav: {
    workspace: 'កន្លែងធ្វើការ',
    dashboard: 'Dashboard',

    organization: 'អង្គភាព',
    permissions: 'សិទ្ធិ',
    roles: 'តួនាទី',
    departments: 'ផ្នែក',
    positions: 'មុខតំណែង',
    lines: 'ខ្សែផលិតកម្ម',
    employees: 'បុគ្គលិក',
    orgChart: 'គំនូសតាងអង្គភាព',

    calendar: 'ប្រតិទិន',
    holidayMaster: 'ថ្ងៃឈប់សម្រាក',

    shift: 'វេន',
    shiftMaster: 'គ្រប់គ្រងវេន',

    accessControl: 'គ្រប់គ្រងសិទ្ធិ',
    accounts: 'គណនី',

    attendance: 'វត្តមាន',
    attendanceImport: 'នាំចូលវត្តមាន',
    attendanceRecords: 'កំណត់ត្រាវត្តមាន',
    otVerification: 'ផ្ទៀងផ្ទាត់ OT',

    overtime: 'ម៉ោងបន្ថែម',
    otRequests: 'សំណើ OT',
    approvalInbox: 'ប្រអប់អនុម័ត',
    acknowledgeInbox: 'ប្រអប់ទទួលដឹង',
    otPolicies: 'គោលការណ៍ OT',
    shiftOtOptions: 'ជម្រើស OT តាមវេន',

    payment: 'ការទូទាត់',
    paymentProcess: 'ដំណើរការទូទាត់',
    paymentFormulas: 'រូបមន្តទូទាត់',
    paymentExchangeRates: 'អត្រាប្តូរប្រាក់',
  },

  access: {
    error: {
      missingPermission: 'អ្នកមិនមានសិទ្ធិដែលត្រូវការទេ។',
      permissionMiddlewareConfigError:
        'Middleware សិទ្ធិខ្វះកូដសិទ្ធិដែលត្រូវការ។',
    },

    permission: {
      tableTitle: 'បញ្ជីសិទ្ធិ',
      searchPlaceholder: 'ស្វែងរកកូដសិទ្ធិ ឈ្មោះ Module ឬការពិពណ៌នា',
      module: 'Module',
      allModules: 'Module ទាំងអស់',

      loading: 'កំពុងផ្ទុកសិទ្ធិ...',
      noData: 'គ្មានសិទ្ធិត្រូវនឹងលក្ខខណ្ឌស្វែងរក។',
      loadFailed: 'ផ្ទុកសិទ្ធិមិនបានសម្រេច។',

      error: {
        notFound: 'រកមិនឃើញសិទ្ធិ។',
      },
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
      roleCodeExample: 'ឧទាហរណ៍៖ SYSTEM_ADMIN',
      displayName: 'ឈ្មោះបង្ហាញ',
      displayNameExample: 'ឧទាហរណ៍៖ System Admin',

      permissionsByModule: 'សិទ្ធិតាម Module',
      count: 'ចំនួន',
      selectedCount: 'បានជ្រើស {count}',
      moduleSelectedCount: 'បានជ្រើស {selected} ក្នុងចំណោម {total}',
      morePermissions: '+{count} ទៀត',

      noData: 'គ្មានតួនាទីត្រូវនឹងលក្ខខណ្ឌស្វែងរក។',
      loadFailed: 'ផ្ទុកតួនាទីមិនបានសម្រេច។',
      saveFailed: 'រក្សាទុកតួនាទីមិនបានសម្រេច។',
      createdSuccess: 'បានបង្កើតតួនាទីដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពតួនាទីដោយជោគជ័យ។',

      validation: {
        codeRequired: 'ត្រូវការកូដតួនាទី។',
        codeTooLong: 'កូដតួនាទីវែងពេក។',
        displayNameRequired: 'ត្រូវការឈ្មោះបង្ហាញ។',
        displayNameTooLong: 'ឈ្មោះបង្ហាញវែងពេក។',
        updatePayloadRequired: 'សូមធ្វើបច្ចុប្បន្នភាពយ៉ាងហោចណាស់មួយវាល។',
      },

      error: {
        notFound: 'រកមិនឃើញតួនាទីប្រព័ន្ធ។',
        codeExists: 'កូដតួនាទីមានរួចហើយ។',
        invalidPermissionIds: 'លេខសម្គាល់សិទ្ធិខ្លះមិនត្រឹមត្រូវ។',
        permissionInactiveOrNotFound:
          'សិទ្ធិខ្លះមិនត្រឹមត្រូវ ឬមិនសកម្ម។',
      },
    },
  },

  org: {
    error: {
      chartCycle: 'គំនូសតាងអង្គភាពមានវដ្តជាប់គ្នា។',
      approverNotFound: 'គំនូសតាងអង្គភាពមានបញ្ហា៖ រកមិនឃើញអ្នកអនុម័ត។',
      chartTooDeep: 'គំនូសតាងអង្គភាពជ្រៅពេក ឬមានវដ្ត។',
    },

    department: {
      tableTitle: 'បញ្ជីផ្នែក',
      searchPlaceholder: 'ស្វែងរកកូដ ឬឈ្មោះ',

      newDepartment: 'ផ្នែកថ្មី',
      importExcel: 'នាំចូល Excel',
      exportExcel: 'នាំចេញ Excel',

      createTitle: 'បង្កើតផ្នែក',
      editTitle: 'កែប្រែផ្នែក',
      departmentCode: 'កូដផ្នែក',
      departmentName: 'ឈ្មោះផ្នែក',
      codeExample: 'ឧទាហរណ៍៖ HR',
      nameExample: 'ឧទាហរណ៍៖ Human Resources',

      exported: 'បាននាំចេញ',
      exportedSuccess: 'បាននាំចេញ Excel ផ្នែកដោយជោគជ័យ។',
      exportFailed: 'នាំចេញមិនបានសម្រេច',

      imported: 'បាននាំចូល',
      importedSuccess:
        'នាំចូលបានបញ្ចប់។ បានបង្កើត៖ {created}, បានធ្វើបច្ចុប្បន្នភាព៖ {updated}។',

      importTitle: 'នាំចូល Excel ផ្នែក',
      importGuideTitle: 'ការណែនាំនាំចូល',
      importGuideStep1: 'ទាញយកឯកសារគំរូ។',
      importGuideStep2: 'បំពេញទិន្នន័យផ្នែកតាមទម្រង់ដូចគ្នា។',
      importGuideStep3: 'ជ្រើសឯកសារ Excel ដែលបានបំពេញពីកុំព្យូទ័ររបស់អ្នក។',
      importGuideStep4: 'ចុច នាំចូល ដើម្បី Upload និងដំណើរការ។',
      importAllOrNothingNote:
        'ជួរទាំងអស់ត្រូវតែត្រឹមត្រូវ 100%។ បើមានជួរណាមួយមានបញ្ហា នោះគ្មានអ្វីត្រូវបានរក្សាទុកទេ។',

      downloadSample: 'ទាញយកគំរូ',
      downloadSampleFailed: 'ទាញយកគំរូមិនបានសម្រេច',
      sampleDownloaded: 'បានទាញយកឯកសារគំរូដោយជោគជ័យ។',

      excelFile: 'ឯកសារ Excel',
      chooseFile: 'ជ្រើសឯកសារ',
      noFileSelected: 'មិនទាន់ជ្រើសឯកសារ',

      importInvalidFileTitle: 'ប្រភេទឯកសារមិនត្រឹមត្រូវ',
      importInvalidFileMessage:
        'សូមជ្រើសតែឯកសារ Excel៖ .xlsx, .xls ឬ .csv។',
      importFailed: 'នាំចូលមិនបានសម្រេច',

      importValidationFailed: 'ផ្ទៀងផ្ទាត់ការនាំចូលមិនបានសម្រេច',
      importErrorCount: 'រកឃើញបញ្ហា {count}',
      importErrorListTitle: 'សូមកែជួរ Excel ទាំងនេះ មុនពេលនាំចូល',
      importRow: 'ជួរ',
      importField: 'វាល',
      importValue: 'តម្លៃ',
      importReason: 'មូលហេតុ',
      importUnknownError: 'បញ្ហាមិនស្គាល់',

      noData: 'គ្មានផ្នែកត្រូវនឹងលក្ខខណ្ឌស្វែងរក។',
      loadFailed: 'ផ្ទុកផ្នែកមិនបានសម្រេច។',
      saveFailed: 'រក្សាទុកផ្នែកមិនបានសម្រេច។',
      createdSuccess: 'បានបង្កើតផ្នែកដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពផ្នែកដោយជោគជ័យ។',

      validation: {
        codeMinLength: 'កូដផ្នែកត្រូវមានយ៉ាងតិច 2 តួអក្សរ។',
        codeTooLong: 'កូដផ្នែកមិនត្រូវលើស 30 តួអក្សរ។',
        nameMinLength: 'ឈ្មោះផ្នែកត្រូវមានយ៉ាងតិច 2 តួអក្សរ។',
        nameTooLong: 'ឈ្មោះផ្នែកមិនត្រូវលើស 120 តួអក្សរ។',
        updatePayloadRequired: 'សូមធ្វើបច្ចុប្បន្នភាពយ៉ាងហោចណាស់មួយវាល។',
      },

      error: {
        notFound: 'រកមិនឃើញផ្នែក។',
        codeExists: 'កូដផ្នែកមានរួចហើយ។',
        invalidId: 'លេខសម្គាល់ផ្នែកមិនត្រឹមត្រូវ។',
        excelFileRequired: 'ត្រូវការឯកសារ Excel។',
        excelNoRows: 'ឯកសារ Excel គ្មានទិន្នន័យជួរ។',
      },

      import: {
        success: {
          completed: 'នាំចូលផ្នែកបានបញ្ចប់ដោយជោគជ័យ។',
        },

        error: {
          validationFailed:
            'នាំចូលមិនបានសម្រេច។ សូមកែបញ្ហាទាំងអស់ រួចព្យាយាមម្តងទៀត។',
          noValidRows: 'ឯកសារ Excel គ្មានជួរផ្នែកដែលត្រឹមត្រូវ។',
          duplicateDatabaseCode:
            'នាំចូលមិនបានសម្រេច ព្រោះកូដផ្នែកខ្លះប៉ះទង្គិចជាមួយទិន្នន័យដែលមានរួច។',

          codeRequired: 'ត្រូវការកូដ។',
          codeMinLength: 'កូដត្រូវមានយ៉ាងតិច {min} តួអក្សរ។',
          codeTooLong: 'កូដមិនត្រូវលើស {max} តួអក្សរ។',

          nameRequired: 'ត្រូវការឈ្មោះ។',
          nameMinLength: 'ឈ្មោះត្រូវមានយ៉ាងតិច {min} តួអក្សរ។',
          nameTooLong: 'ឈ្មោះមិនត្រូវលើស {max} តួអក្សរ។',

          invalidStatus: 'ស្ថានភាពត្រូវតែ Active ឬ Inactive។',
          duplicateCode:
            'កូដ "{code}" ស្ទួនក្នុងឯកសារ Excel។ ឃើញដំបូងនៅជួរ {firstRowNo}។',
        },
      },
    },

    position: {
      tableTitle: 'បញ្ជីមុខតំណែង',
      searchPlaceholder:
        'ស្វែងរកកូដ ឈ្មោះ ផ្នែក មុខតំណែងអ្នកគ្រប់គ្រង ឬការពិពណ៌នា',

      department: 'ផ្នែក',
      allDepartments: 'ផ្នែកទាំងអស់',

      hierarchyScope: 'វិសាលភាពលំដាប់គ្រប់គ្រង',
      allScopes: 'វិសាលភាពទាំងអស់',
      selectHierarchyScope: 'ជ្រើសវិសាលភាពលំដាប់គ្រប់គ្រង',
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
      codeExample: 'ឧទាហរណ៍៖ SEWER',
      nameExample: 'ឧទាហរណ៍៖ Sewer',
      selectDepartment: 'ជ្រើសផ្នែក',

      reportsToPosition: 'រាយការណ៍ទៅមុខតំណែង',
      selectReportsToPosition: 'ជ្រើសមុខតំណែងអ្នកគ្រប់គ្រង ប្រសិនបើមាន',
      reportsToHelp:
        'ឧទាហរណ៍៖ Sewer រាយការណ៍ទៅ Sewing Supervisor។ អាចរាយការណ៍ឆ្លងផ្នែកបាន។',

      managerScope: 'វិសាលភាពអ្នកគ្រប់គ្រង',
      sameLine: 'ខ្សែដូចគ្នា',
      global: 'ទូទៅ',
      managerScopeHelp:
        'ខ្សែដូចគ្នា = រកអ្នកគ្រប់គ្រងក្នុងខ្សែផលិតកម្មដូចគ្នា។ ទូទៅ = រកអ្នកគ្រប់គ្រងតាមមុខតំណែងមេឆ្លងផ្នែក។',

      level: 'កម្រិត',
      activeHelp:
        'មុខតំណែងមិនសកម្មនឹងមិនបង្ហាញក្នុងជម្រើសកំណត់បុគ្គលិកធម្មតា។',
      descriptionPlaceholder: 'ការពិពណ៌នាមុខតំណែង ប្រសិនបើមាន',

      exported: 'បាននាំចេញ',
      exportedSuccess: 'បាននាំចេញ Excel មុខតំណែងដោយជោគជ័យ។',
      exportFailed: 'នាំចេញមិនបានសម្រេច',

      imported: 'បាននាំចូល',
      importedSuccess:
        'នាំចូលបានបញ្ចប់។ បានបង្កើត៖ {created}, បានធ្វើបច្ចុប្បន្នភាព៖ {updated}។',

      importTitle: 'នាំចូល Excel មុខតំណែង',
      importGuideTitle: 'ការណែនាំនាំចូល',
      importGuideStep1: 'ទាញយកឯកសារគំរូ។',
      importGuideStep2: 'បំពេញទិន្នន័យមុខតំណែងដោយប្រើកូដដែលអាចអានបាន។',
      importGuideStep3:
        'Department Code ត្រូវតែមានរួចក្នុង Master Data ផ្នែក។',
      importGuideStep4:
        'Reports To Position Code ត្រូវតែមានរួច ឬមានក្នុងឯកសារនាំចូលដូចគ្នា។',
      importGuideStep5: 'ចុច នាំចូល ដើម្បី Upload និងដំណើរការ។',
      importNote:
        'អ្នកប្រើមិនចាំបាច់ប្រើ Mongo ID ក្នុង Excel ទេ។ ប្រើកូដដែលអាចអានបាន ដូចជា Department Code និង Position Code។',
      importAllOrNothingNote:
        'ជួរទាំងអស់ត្រូវតែត្រឹមត្រូវ 100%។ បើមានជួរណាមួយមានបញ្ហា នោះគ្មានអ្វីត្រូវបានរក្សាទុកទេ។',
      importUploading: 'កំពុង Upload ឯកសារ... {percent}%',
      importProcessing: 'បាន Upload ឯកសារ។ កំពុងផ្ទៀងផ្ទាត់ និងរក្សាទុកទិន្នន័យ...',

      downloadSample: 'ទាញយកគំរូ',
      downloadSampleFailed: 'ទាញយកគំរូមិនបានសម្រេច',
      sampleDownloaded: 'បានទាញយកឯកសារគំរូដោយជោគជ័យ។',

      excelFile: 'ឯកសារ Excel',
      chooseFile: 'ជ្រើសឯកសារ',
      noFileSelected: 'មិនទាន់ជ្រើសឯកសារ',

      importInvalidFileTitle: 'ប្រភេទឯកសារមិនត្រឹមត្រូវ',
      importInvalidFileMessage:
        'សូមជ្រើសតែឯកសារ Excel៖ .xlsx, .xls ឬ .csv។',
      importFailed: 'នាំចូលមិនបានសម្រេច',

      importValidationFailed: 'ផ្ទៀងផ្ទាត់ការនាំចូលមិនបានសម្រេច',
      importErrorCount: 'រកឃើញបញ្ហា {count}',
      importErrorListTitle: 'សូមកែជួរ Excel ទាំងនេះ មុនពេលនាំចូល',
      importRow: 'ជួរ',
      importField: 'វាល',
      importValue: 'តម្លៃ',
      importReason: 'មូលហេតុ',
      importUnknownError: 'បញ្ហាមិនស្គាល់',

      noData: 'គ្មានមុខតំណែងត្រូវនឹងលក្ខខណ្ឌស្វែងរក។',
      loadFailed: 'ផ្ទុកមុខតំណែងមិនបានសម្រេច។',
      departmentLoadFailed: 'ផ្ទុកផ្នែកមិនបានសម្រេច។',
      departmentLookupFailed: 'ផ្ទុកជម្រើសផ្នែកមិនបានសម្រេច។',
      parentLoadFailed: 'ផ្ទុកមុខតំណែងរាយការណ៍ទៅមិនបានសម្រេច។',
      reportsToLookupFailed:
        'ផ្ទុកជម្រើសមុខតំណែងរាយការណ៍ទៅមិនបានសម្រេច។',
      saveFailed: 'រក្សាទុកមុខតំណែងមិនបានសម្រេច។',
      createdSuccess: 'បានបង្កើតមុខតំណែងដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពមុខតំណែងដោយជោគជ័យ។',

      validation: {
        codeMinLength: 'កូដមុខតំណែងត្រូវមានយ៉ាងតិច 2 តួអក្សរ។',
        codeTooLong: 'កូដមុខតំណែងមិនត្រូវលើស 50 តួអក្សរ។',
        nameMinLength: 'ឈ្មោះមុខតំណែងត្រូវមានយ៉ាងតិច 2 តួអក្សរ។',
        nameTooLong: 'ឈ្មោះមុខតំណែងមិនត្រូវលើស 150 តួអក្សរ។',
        descriptionTooLong: 'ការពិពណ៌នាមិនត្រូវលើស 1000 តួអក្សរ។',
        updatePayloadRequired: 'សូមធ្វើបច្ចុប្បន្នភាពយ៉ាងហោចណាស់មួយវាល។',
      },

      error: {
        invalidId: 'លេខសម្គាល់មុខតំណែងមិនត្រឹមត្រូវ។',
        notFound: 'រកមិនឃើញមុខតំណែង។',
        codeExists: 'កូដមុខតំណែងមានរួចហើយ។',
        departmentNotFound: 'រកមិនឃើញផ្នែក។',
        reportsToNotFound: 'រកមិនឃើញមុខតំណែងដែលត្រូវរាយការណ៍ទៅ។',
        cannotReportToSelf: 'មុខតំណែងមិនអាចរាយការណ៍ទៅខ្លួនឯងបានទេ។',
        excelFileRequired: 'ត្រូវការឯកសារ Excel។',
        excelNoRows: 'ឯកសារ Excel គ្មានទិន្នន័យជួរ។',
        excelNoValidRows: 'ឯកសារ Excel គ្មានជួរត្រឹមត្រូវ។',
      },

      import: {
        success: {
          completed: 'នាំចូលមុខតំណែងបានបញ្ចប់ដោយជោគជ័យ។',
        },

        error: {
          validationFailed:
            'នាំចូលមិនបានសម្រេច។ សូមកែបញ្ហាទាំងអស់ រួចព្យាយាមម្តងទៀត។',
          duplicateDatabaseCode:
            'នាំចូលមិនបានសម្រេច ព្រោះកូដមុខតំណែងខ្លះប៉ះទង្គិចជាមួយទិន្នន័យដែលមានរួច។',

          codeRequired: 'ត្រូវការកូដ។',
          codeMinLength: 'កូដត្រូវមានយ៉ាងតិច {min} តួអក្សរ។',
          codeTooLong: 'កូដមិនត្រូវលើស {max} តួអក្សរ។',

          nameRequired: 'ត្រូវការឈ្មោះ។',
          nameMinLength: 'ឈ្មោះត្រូវមានយ៉ាងតិច {min} តួអក្សរ។',
          nameTooLong: 'ឈ្មោះមិនត្រូវលើស {max} តួអក្សរ។',

          departmentCodeTooLong:
            'Department Code មិនត្រូវលើស {max} តួអក្សរ។',
          departmentNotFound:
            'រកមិនឃើញ Department Code "{departmentCode}"។',

          reportsToCodeTooLong:
            'Reports To Position Code មិនត្រូវលើស {max} តួអក្សរ។',
          reportsToNotFound:
            'រកមិនឃើញ Reports To Position Code "{reportsToPositionCode}"។',

          cannotReportToSelf: 'មុខតំណែងមិនអាចរាយការណ៍ទៅខ្លួនឯងបានទេ។',
          invalidScope:
            'Hierarchy Scope ត្រូវតែជា SAME_LINE, GLOBAL ឬ CROSS_DEPARTMENT។',
          invalidLevel: 'Level ត្រូវតែជាលេខធំជាង ឬស្មើ 0។',
          descriptionTooLong:
            'ការពិពណ៌នាមិនត្រូវលើស {max} តួអក្សរ។',
          invalidStatus: 'ស្ថានភាពត្រូវតែ Active ឬ Inactive។',
          duplicateCode:
            'កូដ "{code}" ស្ទួនក្នុងឯកសារ Excel។ ឃើញដំបូងនៅជួរ {firstRowNo}។',
        },
      },
    },

    employee: {
      tableTitle: 'បញ្ជីបុគ្គលិក',
      searchPlaceholder:
        'ស្វែងរកកូដបុគ្គលិក ឈ្មោះ ទូរស័ព្ទ អ៊ីមែល ឬតួនាទី OT',

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
      employeeCodeExample: 'ឧទាហរណ៍៖ TRX001',
      displayNameExample: 'ឧទាហរណ៍៖ John Smith',

      selectDepartment: 'ជ្រើសផ្នែក',
      selectPosition: 'ជ្រើសមុខតំណែង',
      selectLine: 'ជ្រើសខ្សែ',
      selectShift: 'ជ្រើសវេន',
      selectManager: 'ជ្រើសអ្នកគ្រប់គ្រង/ប្រធាន',

      manager: 'អ្នកគ្រប់គ្រង',
      noManager: 'គ្មានអ្នកគ្រប់គ្រង',

      otRole: 'តួនាទី OT',
      otWorkflowRole: {
        title: 'តួនាទី Workflow OT',
        none: 'គ្មាន',
        approver: 'អ្នកអនុម័ត',
        acknowledge: 'អ្នកទទួលដឹង',
      },

      joinDate: 'ថ្ងៃចូលធ្វើការ',
      email: 'អ៊ីមែល',
      phone: 'ទូរស័ព្ទ',
      phonePlaceholder: 'ឧទាហរណ៍៖ 012345678',

      hasAccount: 'មានគណនី',
      noAccount: 'គ្មានគណនី',
      accountAlreadyExists: 'បុគ្គលិកនេះមានគណនីចូលប្រើរួចហើយ។',
      createLoginAccount: 'បង្កើតគណនីចូលប្រើ',

      accountLoginId: 'Account Login ID',
      accountPassword: 'ពាក្យសម្ងាត់គណនី',
      mustChangePassword: 'ត្រូវប្ដូរពាក្យសម្ងាត់',

      accountDefaultNoAccount: 'លំនាំដើម៖ មិនបង្កើតគណនីចូលប្រើទេ។',
      accountPreview: 'Login ID: {loginId} · ពាក្យសម្ងាត់ដើម៖ {password}',

      accountLoginIdPlaceholder: 'លំនាំដើម៖ កូដបុគ្គលិក',
      defaultPassword: 'ពាក្យសម្ងាត់ដើម',
      defaultPasswordPlaceholder: 'លំនាំដើម៖ កូដបុគ្គលិក + ទូរស័ព្ទ',

      accountPhoneRequired:
        'ត្រូវការលេខទូរស័ព្ទពេលបង្កើតគណនី ព្រោះពាក្យសម្ងាត់ដើមប្រើ កូដបុគ្គលិក + លេខទូរស័ព្ទ។',

      accountActive: 'គណនីសកម្ម',

      createdWithAccountSuccess:
        'បានបង្កើតបុគ្គលិក និងគណនីចូលប្រើដោយជោគជ័យ។',
      updatedWithAccountSuccess:
        'បានធ្វើបច្ចុប្បន្នភាពបុគ្គលិក និងបង្កើតគណនីចូលប្រើដោយជោគជ័យ។',

      exported: 'បាននាំចេញ',
      exportedSuccess: 'បាននាំចេញ Excel បុគ្គលិកដោយជោគជ័យ។',
      exportFailed: 'នាំចេញមិនបានសម្រេច',

      imported: 'បាននាំចូល',
      importedSuccess:
        'នាំចូលបានបញ្ចប់។ បានបង្កើត៖ {created}, បានធ្វើបច្ចុប្បន្នភាព៖ {updated}, បានបង្កើតគណនី៖ {accountsCreated}។',

      importTitle: 'នាំចូល Excel បុគ្គលិក',
      importGuideTitle: 'ការណែនាំនាំចូល',
      importGuideStep1: 'ទាញយកឯកសារគំរូ។',
      importGuideStep2: 'បំពេញទិន្នន័យបុគ្គលិកដោយប្រើកូដដែលអាចអានបាន។',
      importGuideStep3:
        'ទម្រង់ Join Date ត្រូវជា DD/MM/YYYY ឧទាហរណ៍ 30/04/2026។',
      importGuideStep4:
        'Department Code, Position Code, Line Code និង Shift Code ត្រូវតែមានរួចក្នុង Master Data។',
      importGuideStep5:
        'ប្រើ Reports To Employee Code សម្រាប់អ្នកគ្រប់គ្រង/ប្រធាន បន្ទាប់មកចុច នាំចូល។',
      importAllOrNothingNote:
        'ជួរទាំងអស់ត្រូវតែត្រឹមត្រូវ 100%។ បើមានជួរណាមួយមានបញ្ហា នោះគ្មានអ្វីត្រូវបានរក្សាទុកទេ។',

      downloadSample: 'ទាញយកគំរូ',
      downloadSampleFailed: 'ទាញយកគំរូមិនបានសម្រេច',
      sampleDownloaded: 'បានទាញយកឯកសារគំរូដោយជោគជ័យ។',

      excelFile: 'ឯកសារ Excel',
      chooseFile: 'ជ្រើសឯកសារ',
      noFileSelected: 'មិនទាន់ជ្រើសឯកសារ',

      importInvalidFileTitle: 'ប្រភេទឯកសារមិនត្រឹមត្រូវ',
      importInvalidFileMessage:
        'សូមជ្រើសតែឯកសារ Excel៖ .xlsx, .xls ឬ .csv។',
      importFailed: 'នាំចូលមិនបានសម្រេច',

      importValidationFailed: 'ផ្ទៀងផ្ទាត់ការនាំចូលមិនបានសម្រេច',
      importErrorCount: 'រកឃើញបញ្ហា {count}',
      importErrorListTitle: 'សូមកែជួរ Excel ទាំងនេះ មុនពេលនាំចូល',
      importRow: 'ជួរ',
      importField: 'វាល',
      importValue: 'តម្លៃ',
      importReason: 'មូលហេតុ',
      importUnknownError: 'បញ្ហាមិនស្គាល់',
      importUploading: 'កំពុង Upload ឯកសារ... {percent}%',

      invalidExcelData: 'ទិន្នន័យ Excel មិនត្រឹមត្រូវ',
      importApiNotFound: 'រកមិនឃើញ API នាំចូល',
      duplicateData: 'ទិន្នន័យស្ទួន',
      serverError: 'បញ្ហា Server',

      employeeCodeRequiredHelp:
        'ត្រូវការកូដបុគ្គលិក ព្រោះប្រព័ន្ធប្រើវាជា Key ដែលអាចអានបាន។',
      joinDateFormatHelp:
        'សូមប្រើទម្រង់ DD/MM/YYYY ឧទាហរណ៍ 30/04/2026។',
      checkDepartmentMaster: 'សូមពិនិត្យ Master Data ផ្នែក។',
      checkPositionMaster: 'សូមពិនិត្យ Master Data មុខតំណែង។',
      positionDepartmentMismatchHelp:
        'Position Code ត្រូវតែស្ថិតក្នុង Department Code ដែលបានជ្រើស។',
      checkLineMaster: 'សូមពិនិត្យ Master Data ខ្សែផលិតកម្ម។',
      checkShiftMaster: 'សូមពិនិត្យ Master Data វេន។',
      checkManagerEmployeeCode:
        'សូមនាំចូលអ្នកគ្រប់គ្រងជាមុន ឬប្រើ Employee Code របស់អ្នកគ្រប់គ្រងដែលមានរួច។',
      uniqueEmailHelp: 'អ៊ីមែលត្រូវតែ unique ឬទុកទទេ។',

      selectLines: 'ជ្រើសខ្សែ',
      lineHelp:
        'ជ្រើសខ្សែមួយ ឬច្រើន។ ខ្សែដំបូងនឹងក្លាយជា primary line សម្រាប់របាយការណ៍ចាស់ និងភាពឆបគ្នា។',
      multiLineHelp:
        'ជ្រើសខ្សែមួយ ឬច្រើន។ ខ្សែដំបូងនឹងក្លាយជា primary line សម្រាប់របាយការណ៍ចាស់ និងភាពឆបគ្នា។',

      noData: 'គ្មានបុគ្គលិកត្រូវនឹងលក្ខខណ្ឌស្វែងរក។',
      loadFailed: 'ផ្ទុកបុគ្គលិកមិនបានសម្រេច។',
      departmentLoadFailed: 'ផ្ទុកផ្នែកមិនបានសម្រេច។',
      positionLoadFailed: 'ផ្ទុកមុខតំណែងមិនបានសម្រេច។',
      lineLoadFailed: 'ផ្ទុកខ្សែមិនបានសម្រេច។',
      shiftLoadFailed: 'ផ្ទុកវេនមិនបានសម្រេច។',
      managerLoadFailed: 'ផ្ទុកអ្នកគ្រប់គ្រងមិនបានសម្រេច។',
      saveFailed: 'រក្សាទុកបុគ្គលិកមិនបានសម្រេច។',
      createdSuccess: 'បានបង្កើតបុគ្គលិកដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពបុគ្គលិកដោយជោគជ័យ។',

      field: {
        departmentId: {
          required: 'ត្រូវការផ្នែក។',
          invalid: 'ផ្នែកមិនត្រឹមត្រូវ។',
        },
        positionId: {
          required: 'ត្រូវការមុខតំណែង។',
          invalid: 'មុខតំណែងមិនត្រឹមត្រូវ។',
        },
        lineId: {
          required: 'ត្រូវការខ្សែ។',
          invalid: 'ខ្សែមិនត្រឹមត្រូវ។',
        },
        lineIds: {
          required: 'ត្រូវការខ្សែ។',
          invalid: 'ខ្សែដែលបានជ្រើសខ្លះមិនត្រឹមត្រូវ។',
        },
        shiftId: {
          required: 'ត្រូវការវេន។',
          invalid: 'វេនមិនត្រឹមត្រូវ។',
        },
        reportsToEmployeeId: {
          required: 'ត្រូវការអ្នកគ្រប់គ្រង។',
          invalid: 'អ្នកគ្រប់គ្រងមិនត្រឹមត្រូវ។',
        },
      },

      validation: {
        employeeCodeRequired: 'ត្រូវការកូដបុគ្គលិក។',
        employeeCodeTooLong: 'កូដបុគ្គលិកមិនត្រូវលើស 50 តួអក្សរ។',
        displayNameRequired: 'ត្រូវការឈ្មោះបង្ហាញ។',
        displayNameTooLong: 'ឈ្មោះបង្ហាញមិនត្រូវលើស 150 តួអក្សរ។',
        departmentCodeRequired: 'ត្រូវការ Department Code។',
        departmentCodeTooLong:
          'Department Code មិនត្រូវលើស 50 តួអក្សរ។',
        positionCodeRequired: 'ត្រូវការ Position Code។',
        positionCodeTooLong: 'Position Code មិនត្រូវលើស 50 តួអក្សរ។',
        shiftCodeRequired: 'ត្រូវការ Shift Code។',
        shiftCodeTooLong: 'Shift Code មិនត្រូវលើស 50 តួអក្សរ។',
        phoneTooLong: 'លេខទូរស័ព្ទមិនត្រូវលើស 30 តួអក្សរ។',
        phoneRequiredForAccount:
          'ត្រូវការលេខទូរស័ព្ទពេលបង្កើតគណនីចូលប្រើសម្រាប់បុគ្គលិក។',
        joinDateInvalid: 'ថ្ងៃចូលធ្វើការមិនត្រឹមត្រូវ។',
        otWorkflowRoleInvalid:
          'OT Workflow Role ត្រូវតែជា NONE, APPROVER ឬ ACKNOWLEDGE។',
        isActiveInvalid: 'ស្ថានភាពមិនត្រឹមត្រូវ។',
        updatePayloadRequired: 'សូមធ្វើបច្ចុប្បន្នភាពយ៉ាងហោចណាស់មួយវាល។',
      },

      error: {
        notFound: 'រកមិនឃើញបុគ្គលិក។',
        inactive: 'បុគ្គលិកមិនសកម្ម។',
        notInScope: 'បុគ្គលិកនៅក្រៅវិសាលភាពរបស់អ្នក។',
        outsideManagedScope:
          'បុគ្គលិកដែលបានជ្រើសខ្លះនៅក្រៅវិសាលភាពគ្រប់គ្រងរបស់អ្នក។',
        employeeCodeExists: 'កូដបុគ្គលិកមានរួចហើយ។',
        emailExists: 'អ៊ីមែលមានរួចហើយ។',
        accountExists: 'បុគ្គលិកនេះមានគណនីរួចហើយ។',
        reportToSelf: 'បុគ្គលិកមិនអាចរាយការណ៍ទៅខ្លួនឯងបានទេ។',
        reportsToEmployeeNotFound: 'រកមិនឃើញបុគ្គលិកដែលត្រូវរាយការណ៍ទៅ។',
        excelFileRequired: 'ត្រូវការឯកសារ Excel។',
        excelWorksheetRequired: 'ឯកសារ Excel គ្មាន worksheet។',
        excelNoRows: 'ឯកសារ Excel គ្មានទិន្នន័យជួរ។',
        excelNoValidRows: 'ឯកសារ Excel គ្មានជួរត្រឹមត្រូវ។',
      },

      import: {
        success: {
          completed: 'នាំចូលបុគ្គលិកបានបញ្ចប់ដោយជោគជ័យ។',
        },

        error: {
          validationFailed:
            'នាំចូលមិនបានសម្រេច។ សូមកែបញ្ហាទាំងអស់ រួចព្យាយាមម្តងទៀត។',
          duplicateDatabaseValue:
            'នាំចូលមិនបានសម្រេច ព្រោះតម្លៃខ្លះប៉ះទង្គិចជាមួយទិន្នន័យបុគ្គលិកដែលមានរួច។',

          employeeCodeRequired: 'ត្រូវការកូដបុគ្គលិក។',
          employeeCodeTooLong:
            'កូដបុគ្គលិកមិនត្រូវលើស 50 តួអក្សរ។',
          duplicateEmployeeCode:
            'Employee Code "{employeeCode}" ស្ទួនក្នុងឯកសារ Excel។ ឃើញដំបូងនៅជួរ {firstRowNo}។',

          displayNameRequired: 'ត្រូវការឈ្មោះបង្ហាញ។',
          displayNameTooLong:
            'ឈ្មោះបង្ហាញមិនត្រូវលើស 150 តួអក្សរ។',

          departmentCodeRequired: 'ត្រូវការ Department Code។',
          departmentCodeTooLong:
            'Department Code មិនត្រូវលើស 50 តួអក្សរ។',
          departmentNotFound:
            'រកមិនឃើញ Department Code "{departmentCode}"។',

          positionCodeRequired: 'ត្រូវការ Position Code។',
          positionCodeTooLong:
            'Position Code មិនត្រូវលើស 50 តួអក្សរ។',
          positionNotFound: 'រកមិនឃើញ Position Code "{positionCode}"។',
          positionDepartmentMismatch:
            'Position Code "{positionCode}" មិនស្ថិតក្នុង Department Code "{departmentCode}" ទេ។',

          lineCodeTooLong: 'Line Code មិនត្រូវលើស 50 តួអក្សរ។',
          lineNotFound: 'រកមិនឃើញ Line Code៖ {lineCodes}។',
          lineInactive: 'Line Code មិនសកម្ម៖ {lineCodes}។',
          lineDepartmentMismatch:
            'Line Code ទាំងនេះមិនគាំទ្រ Department Code "{departmentCode}" ទេ៖ {lineCodes}។',
          linePositionNotAllowed:
            'Line Code ទាំងនេះមិនអនុញ្ញាត Position Code "{positionCode}" ទេ៖ {lineCodes}។',

          shiftCodeRequired: 'ត្រូវការ Shift Code។',
          shiftCodeTooLong: 'Shift Code មិនត្រូវលើស 50 តួអក្សរ។',
          shiftNotFound:
            'រកមិនឃើញ Shift Code "{shiftCode}" ឬវាមិនសកម្ម។',

          managerCodeTooLong:
            'Reports To Employee Code មិនត្រូវលើស 50 តួអក្សរ។',
          managerNotFound:
            'រកមិនឃើញ Reports To Employee Code "{reportsToEmployeeCode}" ក្នុង Employee master ឬឯកសារនាំចូលនេះ។',
          reportToSelf: 'បុគ្គលិកមិនអាចរាយការណ៍ទៅខ្លួនឯងបានទេ។',

          invalidOTWorkflowRole:
            'OT Workflow Role ត្រូវតែជា NONE, APPROVER ឬ ACKNOWLEDGE។',
          phoneTooLong: 'លេខទូរស័ព្ទមិនត្រូវលើស 30 តួអក្សរ។',
          emailTooLong: 'អ៊ីមែលមិនត្រូវលើស 150 តួអក្សរ។',
          emailInvalid: 'ទម្រង់អ៊ីមែលមិនត្រឹមត្រូវ។',
          duplicateEmail:
            'Email "{email}" ស្ទួនក្នុងឯកសារ Excel។ ឃើញដំបូងនៅជួរ {firstRowNo}។',
          emailExists:
            'Email "{email}" មានរួចហើយសម្រាប់ Employee Code "{ownerEmployeeCode}"។',

          invalidJoinDate:
            'Join Date ត្រូវប្រើទម្រង់ DD/MM/YYYY ឬ YYYY-MM-DD។',
          invalidStatus: 'ស្ថានភាពត្រូវតែ Active ឬ Inactive។',
          invalidCreateAccount: 'Create Account ត្រូវតែជា Yes ឬ No។ ទទេ = No។',

          phoneRequiredForAccount:
            'ត្រូវការលេខទូរស័ព្ទ ព្រោះ Create Account = Yes។ ពាក្យសម្ងាត់ដើម = Employee Code + Phone។',
          defaultPasswordInvalid:
            'ពាក្យសម្ងាត់ដើមត្រូវមាន 6 ទៅ 100 តួអក្សរ។ វាបង្កើតពី Employee Code + Phone។',
          accountLoginIdExists: 'Account Login ID "{loginId}" មានរួចហើយ។',
        },
      },

      importProgress: {
        waitingUpload: 'កំពុងរង់ចាំ Upload ឯកសារ...',
        readFile: 'កំពុងអានឯកសារ Excel...',
        parseRows: 'កំពុងអានជួរ worksheet...',
        validateBasic: 'កំពុងពិនិត្យវាលចាំបាច់ និងជួរស្ទួន...',
        matchDepartment: 'កំពុងផ្គូផ្គងកូដផ្នែក...',
        matchPosition: 'កំពុងផ្គូផ្គងកូដមុខតំណែង...',
        matchLine: 'កំពុងផ្គូផ្គងកូដខ្សែផលិតកម្ម...',
        matchShift: 'កំពុងផ្គូផ្គងកូដវេន...',
        matchEmployee: 'កំពុងពិនិត្យបុគ្គលិកដែលមានរួច និងកូដអ្នកគ្រប់គ្រង...',
        matchAccount: 'កំពុងពិនិត្យគណនីចូលប្រើបុគ្គលិក...',
        validateRelation:
          'កំពុងផ្ទៀងផ្ទាត់ទំនាក់ទំនងផ្នែក មុខតំណែង ខ្សែ វេន អ្នកគ្រប់គ្រង និងគណនី...',
        startImport: 'Master data ទាំងអស់ផ្គូផ្គងរួច។ កំពុងចាប់ផ្ដើមនាំចូលបុគ្គលិក...',
        importEmployee: 'កំពុងនាំចូលបុគ្គលិក...',
        resolveManager: 'កំពុងដោះស្រាយអ្នកគ្រប់គ្រង...',
        createAccount: 'កំពុងបង្កើតគណនីចូលប្រើបុគ្គលិក...',
        syncManager: 'កំពុងបញ្ចប់ការកំណត់អ្នកគ្រប់គ្រងខ្សែ...',
        completed: 'នាំចូលបុគ្គលិកបានបញ្ចប់។',
        failed: 'នាំចូលបុគ្គលិកមិនបានសម្រេច។ សូមកែឯកសារ Excel រួចព្យាយាមម្តងទៀត។',

        guideSubtitle:
          'Upload ឯកសារ Excel បុគ្គលិក ហើយតាមដានជំហាននាំចូលជាក់ស្តែង។',
        runningTitle: 'ដំណើរការនាំចូលបុគ្គលិក',
        percentDone: 'បានបញ្ចប់ {percent}%',
        rowProgress: 'បានដំណើរការ {processed} ក្នុងចំណោម {total} ជួរ',
        fileUpload: 'Upload ឯកសារ៖ {percent}%',

        statusWaiting: 'កំពុងរង់ចាំ',
        statusRunning: 'កំពុងដំណើរការ',
        statusSuccess: 'ជោគជ័យ',
        statusFailed: 'បរាជ័យ',

        phase: {
          UPLOAD: 'Upload ឯកសារ',
          READ_FILE: 'អានឯកសារ',
          PARSE_ROWS: 'អានជួរ',
          VALIDATE_BASIC: 'ផ្ទៀងផ្ទាត់វាលមូលដ្ឋាន',
          MATCH_DEPARTMENT: 'ផ្គូផ្គងផ្នែក',
          MATCH_POSITION: 'ផ្គូផ្គងមុខតំណែង',
          MATCH_LINE: 'ផ្គូផ្គងខ្សែ',
          MATCH_SHIFT: 'ផ្គូផ្គងវេន',
          MATCH_EMPLOYEE: 'ពិនិត្យបុគ្គលិក',
          MATCH_ACCOUNT: 'ពិនិត្យគណនី',
          VALIDATE_RELATION: 'ផ្ទៀងផ្ទាត់ទំនាក់ទំនង',
          IMPORT_EMPLOYEE: 'នាំចូលបុគ្គលិក',
          RESOLVE_MANAGER: 'ដោះស្រាយអ្នកគ្រប់គ្រង',
          CREATE_ACCOUNT: 'បង្កើតគណនី',
          SYNC_MANAGER: 'Sync អ្នកគ្រប់គ្រង',
          COMPLETE: 'បញ្ចប់',
        },
      },
    },

    line: {
      tableTitle: 'បញ្ជីខ្សែផលិតកម្ម',
      searchPlaceholder: 'ស្វែងរកកូដ ឈ្មោះ ឬការពិពណ៌នា',

      department: 'ផ្នែក',
      departments: 'ផ្នែក',
      allDepartments: 'ផ្នែកទាំងអស់',

      lineCode: 'កូដខ្សែ',
      lineName: 'ឈ្មោះខ្សែ',
      allowedPositions: 'មុខតំណែងអនុញ្ញាត',
      allPositionsInDepartment: 'មុខតំណែងទាំងអស់ក្នុងផ្នែក',
      allPositionsInDepartments: 'មុខតំណែងទាំងអស់ក្នុងផ្នែកដែលបានជ្រើស',

      newLine: 'ខ្សែថ្មី',
      importExcel: 'នាំចូល Excel',
      exportExcel: 'នាំចេញ Excel',

      createTitle: 'បង្កើតខ្សែផលិតកម្ម',
      editTitle: 'កែប្រែខ្សែផលិតកម្ម',

      selectDepartment: 'ជ្រើសផ្នែក',
      selectDepartments: 'ជ្រើសផ្នែក',
      selectAllowedPositions: 'ជ្រើសមុខតំណែងអនុញ្ញាត ប្រសិនបើមាន',

      codeExample: 'ឧទាហរណ៍៖ LINE-01',
      nameExample: 'ឧទាហរណ៍៖ Sewing Line 01',
      descriptionPlaceholder: 'ការពិពណ៌នាខ្សែផលិតកម្ម ប្រសិនបើមាន',

      allowedPositionsMultiDepartmentHelp:
        'ទុកទទេដើម្បីអនុញ្ញាតមុខតំណែងទាំងអស់ក្នុងផ្នែកដែលបានជ្រើស។ ជ្រើសមុខតំណែងតែពេលខ្សែនេះត្រូវកំណត់ទៅមុខតំណែងជាក់លាក់។',

      exported: 'បាននាំចេញ',
      exportedSuccess: 'បាននាំចេញខ្សែផលិតកម្មដោយជោគជ័យ។',
      exportFailed: 'នាំចេញខ្សែផលិតកម្មមិនបានសម្រេច។',

      imported: 'បាននាំចូល',
      importedSuccess:
        'នាំចូលបានបញ្ចប់។ បានបង្កើត៖ {created}, បានធ្វើបច្ចុប្បន្នភាព៖ {updated}។',

      importTitle: 'នាំចូលខ្សែផលិតកម្ម',
      importGuideTitle: 'ការណែនាំនាំចូល',
      importGuideStep1: 'ទាញយកឯកសារគំរូ។',
      importGuideStep2:
        'បំពេញទិន្នន័យខ្សែផលិតកម្មដោយប្រើកូដដែលអាចអានបាន។',
      importGuideStep3:
        'Department Code ត្រូវតែមានរួចក្នុង Master Data ផ្នែក។',
      importGuideStep4:
        'ប្រើ Position Codes តែពេលខ្សែអនុញ្ញាតមុខតំណែងជាក់លាក់។',
      importAllOrNothingNote:
        'ជួរទាំងអស់ត្រូវតែត្រឹមត្រូវ 100%។ បើមានជួរណាមួយមានបញ្ហា នោះគ្មានអ្វីត្រូវបានរក្សាទុកទេ។',
      importUploading: 'កំពុង Upload ឯកសារ... {percent}%',
      importProcessing: 'បាន Upload ឯកសារ។ កំពុងផ្ទៀងផ្ទាត់ និងរក្សាទុកទិន្នន័យ...',

      downloadSample: 'ទាញយកគំរូ',
      downloadSampleFailed: 'ទាញយកគំរូមិនបានសម្រេច',
      sampleDownloaded: 'បានទាញយកឯកសារគំរូដោយជោគជ័យ។',

      excelFile: 'ឯកសារ Excel',
      chooseFile: 'ជ្រើសឯកសារ',
      noFileSelected: 'មិនទាន់ជ្រើសឯកសារ',

      importInvalidFileTitle: 'ប្រភេទឯកសារមិនត្រឹមត្រូវ',
      importInvalidFileMessage:
        'សូមជ្រើសតែឯកសារ Excel៖ .xlsx, .xls ឬ .csv។',
      importFailed: 'នាំចូលមិនបានសម្រេច',

      importValidationFailed: 'ផ្ទៀងផ្ទាត់ការនាំចូលមិនបានសម្រេច',
      importErrorCount: 'រកឃើញបញ្ហា {count}',
      importErrorListTitle: 'សូមកែជួរ Excel ទាំងនេះ មុនពេលនាំចូល',
      importRow: 'ជួរ',
      importField: 'វាល',
      importValue: 'តម្លៃ',
      importReason: 'មូលហេតុ',
      importUnknownError: 'បញ្ហាមិនស្គាល់',

      noData: 'គ្មានខ្សែផលិតកម្មត្រូវនឹងលក្ខខណ្ឌស្វែងរក។',
      loadFailed: 'ផ្ទុកខ្សែផលិតកម្មមិនបានសម្រេច។',
      departmentLoadFailed: 'ផ្ទុកផ្នែកមិនបានសម្រេច។',
      positionLoadFailed: 'ផ្ទុកមុខតំណែងមិនបានសម្រេច។',
      saveFailed: 'រក្សាទុកខ្សែផលិតកម្មមិនបានសម្រេច។',
      createdSuccess: 'បានបង្កើតខ្សែផលិតកម្មដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពខ្សែផលិតកម្មដោយជោគជ័យ។',

      field: {
        departmentId: {
          required: 'ត្រូវការផ្នែក។',
          invalid: 'ផ្នែកមិនត្រឹមត្រូវ។',
        },
        departmentIds: {
          required: 'ត្រូវការផ្នែកយ៉ាងហោចណាស់មួយ។',
          invalid: 'ផ្នែកដែលបានជ្រើសខ្លះមិនត្រឹមត្រូវ។',
        },
        positionIds: {
          required: 'ត្រូវការមុខតំណែង។',
          invalid: 'មុខតំណែងដែលបានជ្រើសខ្លះមិនត្រឹមត្រូវ។',
        },
      },

      validation: {
        codeRequired: 'ត្រូវការកូដខ្សែ។',
        codeTooLong: 'កូដខ្សែមិនត្រូវលើស 50 តួអក្សរ។',
        nameRequired: 'ត្រូវការឈ្មោះខ្សែ។',
        nameTooLong: 'ឈ្មោះខ្សែមិនត្រូវលើស 120 តួអក្សរ។',
        departmentRequired: 'ត្រូវការផ្នែកយ៉ាងហោចណាស់មួយ។',
        descriptionTooLong: 'ការពិពណ៌នាមិនត្រូវលើស 500 តួអក្សរ។',
        updatePayloadRequired: 'សូមធ្វើបច្ចុប្បន្នភាពយ៉ាងហោចណាស់មួយវាល។',
      },

      error: {
        notFound: 'រកមិនឃើញខ្សែផលិតកម្ម។',
        codeExists: 'កូដខ្សែមានរួចហើយ។',
        inactive: 'ខ្សែមិនសកម្ម។',
        departmentMismatch: 'ខ្សែដែលបានជ្រើសមិនគាំទ្រផ្នែកបុគ្គលិកនេះទេ។',
        positionNotAllowed: 'ខ្សែដែលបានជ្រើសមិនអនុញ្ញាតមុខតំណែងបុគ្គលិកនេះទេ។',
        positionDepartmentMismatch:
          'មុខតំណែងដែលបានជ្រើសមិនស្ថិតក្នុងផ្នែករបស់ខ្សែដែលបានជ្រើសទេ។',
        excelFileRequired: 'ត្រូវការឯកសារ Excel។',
        excelNoRows: 'ឯកសារ Excel គ្មានទិន្នន័យជួរ។',
        excelNoValidRows: 'ឯកសារ Excel គ្មានជួរត្រឹមត្រូវ។',
      },

      import: {
        success: {
          completed: 'នាំចូលខ្សែផលិតកម្មបានបញ្ចប់ដោយជោគជ័យ។',
        },

        error: {
          validationFailed:
            'នាំចូលមិនបានសម្រេច។ សូមកែបញ្ហាទាំងអស់ រួចព្យាយាមម្តងទៀត។',
          duplicateDatabaseCode:
            'នាំចូលមិនបានសម្រេច ព្រោះកូដខ្សែខ្លះប៉ះទង្គិចជាមួយទិន្នន័យដែលមានរួច។',

          codeRequired: 'ត្រូវការកូដ។',
          codeTooLong: 'កូដមិនត្រូវលើស {max} តួអក្សរ។',
          duplicateCode:
            'Line Code "{code}" ស្ទួនក្នុងឯកសារ Excel។ ឃើញដំបូងនៅជួរ {firstRowNo}។',

          nameRequired: 'ត្រូវការឈ្មោះ។',
          nameTooLong: 'ឈ្មោះមិនត្រូវលើស {max} តួអក្សរ។',

          departmentRequired: 'ត្រូវការ Department Codes។',
          departmentCodeTooLong:
            'Department Code មិនត្រូវលើស {max} តួអក្សរ៖ {departmentCodes}។',
          duplicateDepartmentCodeInRow:
            'Department Code ស្ទួនក្នុងជួរដូចគ្នា៖ {departmentCodes}។',
          departmentNotFound: 'រកមិនឃើញ Department Code៖ {departmentCodes}។',

          positionCodeTooLong:
            'Position Code មិនត្រូវលើស {max} តួអក្សរ៖ {positionCodes}។',
          duplicatePositionCodeInRow:
            'Position Code ស្ទួនក្នុងជួរដូចគ្នា៖ {positionCodes}។',
          positionNotFound:
            'រកមិនឃើញ Position Code៖ {positionCodes}។ Position Codes ត្រូវប្រើកូដពី Position master មិនមែន Department codes ទេ។',
          positionDepartmentMismatch:
            'Position Code ទាំងនេះមិនស្ថិតក្នុង Department Codes "{departmentCodes}" ទេ៖ {positionCodes}។',

          descriptionTooLong: 'ការពិពណ៌នាមិនត្រូវលើស {max} តួអក្សរ។',
          invalidStatus: 'ស្ថានភាពត្រូវតែ Active ឬ Inactive។',
        },
      },
    },

    orgChart: {
      searchPlaceholder: 'ស្វែងរកកូដបុគ្គលិក ឬឈ្មោះ',
      rootPerson: 'បុគ្គលិកដើម',
      selectRootPerson: 'ជ្រើសបុគ្គលិកដើម',
      includeInactive: 'រួមបញ្ចូលមិនសកម្ម',

      treeTitle: 'គំនូសតាងអង្គភាព',
      zoomLabel: 'Zoom: {zoom}',
      zoomIn: 'ពង្រីក',
      zoomOut: 'បង្រួម',
      resetZoom: 'កំណត់ឡើងវិញ',

      noEmployeeCode: 'គ្មាន ID',
      noPosition: 'គ្មានមុខតំណែង',
      noDepartment: 'គ្មានផ្នែក',

      noTreeData: 'រកមិនឃើញទិន្នន័យគំនូសតាងអង្គភាព។',
      loadFailed: 'ផ្ទុកគំនូសតាងអង្គភាពមិនបានសម្រេច។',

      expandNode: 'ពង្រីក Node',
      collapseNode: 'បង្រួម Node',
    },
  },

  employee: {
    error: {
      notFound: 'រកមិនឃើញបុគ្គលិក។',
      inactive: 'បុគ្គលិកមិនសកម្ម។',
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
      loadFailed: 'ផ្ទុកថ្ងៃឈប់សម្រាកមិនបានសម្រេច។',

      importExcel: 'នាំចូល Excel',
      exportExcel: 'នាំចេញ Excel',
      newHoliday: 'ថ្ងៃឈប់សម្រាកថ្មី',
      createTitle: 'បង្កើតថ្ងៃឈប់សម្រាក',
      editTitle: 'កែប្រែថ្ងៃឈប់សម្រាក',
      createOnSelectedDate: 'បង្កើត',
      editHoliday: 'កែប្រែ',

      selectHolidayDate: 'ជ្រើសថ្ងៃឈប់សម្រាក',
      holidayCode: 'កូដថ្ងៃឈប់សម្រាក',
      codeExample: 'ឧទាហរណ៍៖ KHNY',
      holidayName: 'ឈ្មោះថ្ងៃឈប់សម្រាក',
      nameExample: 'ឧទាហរណ៍៖ បុណ្យចូលឆ្នាំខ្មែរ',
      descriptionPlaceholder: 'កំណត់ចំណាំ ឬការពិពណ៌នា ប្រសិនបើមាន',
      selectedDayType: 'ប្រភេទថ្ងៃដែលបានជ្រើស',

      paidHoliday: 'ថ្ងៃឈប់សម្រាកមានប្រាក់ឈ្នួល',
      paidHolidayHelp: 'ប្រើវានៅពេលថ្ងៃឈប់សម្រាកនេះគិតប្រាក់ឈ្នួល។',
      activeHelp:
        'ថ្ងៃឈប់សម្រាកមិនសកម្មនឹងមិនប្រើសម្រាប់កំណត់ប្រភេទថ្ងៃទេ។',
      paid: 'មានប្រាក់ឈ្នួល',
      unpaid: 'គ្មានប្រាក់ឈ្នួល',
      noCode: 'គ្មានកូដ',

      createdSuccess: 'បានបង្កើតថ្ងៃឈប់សម្រាកដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពថ្ងៃឈប់សម្រាកដោយជោគជ័យ។',
      saveFailed: 'រក្សាទុកថ្ងៃឈប់សម្រាកមិនបានសម្រេច។',

      exported: 'បាននាំចេញ',
      exportedSuccess: 'បាននាំចេញ Excel ថ្ងៃឈប់សម្រាកដោយជោគជ័យ។',
      exportFailed: 'នាំចេញថ្ងៃឈប់សម្រាកមិនបានសម្រេច។',

      imported: 'បាននាំចូល',
      importedSuccess:
        'នាំចូលបានបញ្ចប់។ បានបង្កើត៖ {created}, បានធ្វើបច្ចុប្បន្នភាព៖ {updated}។',

      importTitle: 'នាំចូលថ្ងៃឈប់សម្រាក',
      importInvalidFileTitle: 'ប្រភេទឯកសារមិនត្រឹមត្រូវ',
      importInvalidFileMessage:
        'សូមជ្រើសតែឯកសារ Excel៖ .xlsx, .xls ឬ .csv។',
      importFailed: 'នាំចូលថ្ងៃឈប់សម្រាកមិនបានសម្រេច។',

      importGuideTitle: 'ការណែនាំនាំចូល',
      importGuideStep1: 'ទាញយកឯកសារគំរូ។',
      importGuideStep2:
        'បំពេញថ្ងៃឈប់សម្រាក កូដ ឈ្មោះ Paid Holiday និងស្ថានភាព។',
      importGuideStep3: 'ប្រើទម្រង់ DD/MM/YYYY សម្រាប់កាលបរិច្ឆេទ។',
      importGuideStep4: 'Upload ឯកសារដែលបានបំពេញ។',
      importNote:
        'ថ្ងៃឈប់សម្រាកដែលមានកាលបរិច្ឆេទដូចគ្នានឹងត្រូវបានធ្វើបច្ចុប្បន្នភាព។ អ្នកប្រើមិនចាំបាច់ប្រើ Mongo ID ក្នុង Excel ទេ។',

      downloadSample: 'ទាញយកគំរូ',
      sampleDownloaded: 'បានទាញយកឯកសារគំរូដោយជោគជ័យ។',
      downloadSampleFailed: 'ទាញយកឯកសារគំរូមិនបានសម្រេច។',

      excelFile: 'ឯកសារ Excel',
      chooseFile: 'ជ្រើសឯកសារ',
      noFileSelected: 'មិនទាន់ជ្រើសឯកសារ',

      validation: {
        dateInvalid: 'កាលបរិច្ឆេទថ្ងៃឈប់សម្រាកមិនត្រឹមត្រូវ។',
        codeTooLong: 'កូដថ្ងៃឈប់សម្រាកមិនត្រូវលើស 50 តួអក្សរ។',
        nameRequired: 'ត្រូវការឈ្មោះថ្ងៃឈប់សម្រាក។',
        nameTooLong: 'ឈ្មោះថ្ងៃឈប់សម្រាកមិនត្រូវលើស 150 តួអក្សរ។',
        descriptionTooLong: 'ការពិពណ៌នាមិនត្រូវលើស 1000 តួអក្សរ។',
        updatePayloadRequired: 'សូមធ្វើបច្ចុប្បន្នភាពយ៉ាងហោចណាស់មួយវាល។',
      },

      error: {
        invalidDate: 'កាលបរិច្ឆេទថ្ងៃឈប់សម្រាកមិនត្រឹមត្រូវ។',
        dateExists: 'មានថ្ងៃឈប់សម្រាកសម្រាប់កាលបរិច្ឆេទនេះរួចហើយ។',
        notFound: 'រកមិនឃើញថ្ងៃឈប់សម្រាក។',
        excelFileRequired: 'ត្រូវការឯកសារ Excel។',
        excelNoRows: 'ឯកសារ Excel គ្មានទិន្នន័យជួរ។',
      },

      import: {
        success: {
          completed: 'នាំចូលថ្ងៃឈប់សម្រាកបានបញ្ចប់ដោយជោគជ័យ។',
        },

        error: {
          dateRequired: 'ត្រូវការកាលបរិច្ឆេទ។ ប្រើទម្រង់ DD/MM/YYYY។',
          nameRequired: 'ត្រូវការឈ្មោះថ្ងៃឈប់សម្រាក។',
          invalidPaidHoliday:
            'Paid Holiday ត្រូវតែជា Yes ឬ No។ ទទេនឹងត្រូវចាត់ទុកជា Yes។',
          invalidStatus:
            'ស្ថានភាពត្រូវតែ Active ឬ Inactive។ ទទេនឹងត្រូវចាត់ទុកជា Active។',
          duplicateDate:
            'កាលបរិច្ឆេទថ្ងៃឈប់សម្រាក "{date}" ស្ទួនក្នុងឯកសារនាំចូលនៅជួរ {rowNo}។',
        },
      },
    },
  },

  shift: {
    tableTitle: 'បញ្ជីវេន',

    type: {
      day: 'ថ្ងៃ',
      night: 'យប់',
    },

    filter: {
      searchPlaceholder: 'ស្វែងរកកូដ ឬឈ្មោះ',
      type: 'ប្រភេទ',
      allTypes: 'ប្រភេទទាំងអស់',
    },

    action: {
      newShift: 'វេនថ្មី',
      createShift: 'បង្កើតវេន',
      importExcel: 'នាំចូល Excel',
      exportExcel: 'នាំចេញ Excel',
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
      working: 'ធ្វើការ',
    },

    table: {
      empty: 'គ្មានវេនត្រូវនឹងលក្ខខណ្ឌស្វែងរក។',
    },

    dialog: {
      createTitle: 'បង្កើតវេន',
      editTitle: 'កែប្រែវេន',
    },

    form: {
      code: 'កូដវេន',
      name: 'ឈ្មោះវេន',
      type: 'ប្រភេទវេន',
      startTime: 'ម៉ោងចាប់ផ្តើម',
      breakStartTime: 'ម៉ោងចាប់ផ្តើមសម្រាក',
      breakEndTime: 'ម៉ោងបញ្ចប់សម្រាក',
      endTime: 'ម៉ោងបញ្ចប់',
      activeStatus: 'ស្ថានភាពសកម្ម',

      codePlaceholder: 'ឧទាហរណ៍៖ DAY-0700',
      namePlaceholder: 'ឧទាហរណ៍៖ Day Shift 07:00 - 16:00',
      typePlaceholder: 'ជ្រើសប្រភេទវេន',

      timeHint:
        'ប្រើទម្រង់ HH:mm។ ឧទាហរណ៍៖ 07:00, 12:00, 13:00, 16:00។ វេនថ្ងៃមិនអាចឆ្លងរាត្រីបានទេ។ វេនយប់ត្រូវតែឆ្លងរាត្រី។',
    },

    duration: {
      hours: '{hours}ម៉',
      minutes: '{minutes} នាទី',
      hoursMinutes: '{hours}ម៉ {minutes}ន',
    },

    permission: {
      noView: 'អ្នកមិនមានសិទ្ធិមើលវេនទេ។',
    },

    toast: {
      loadFailedDetail: 'ផ្ទុកវេនមិនបានសម្រេច។',
      createdDetail: 'បានបង្កើតវេនដោយជោគជ័យ។',
      updatedDetail: 'បានធ្វើបច្ចុប្បន្នភាពវេនដោយជោគជ័យ។',
      saveFailedDetail: 'រក្សាទុកវេនមិនបានសម្រេច។',

      exportedTitle: 'បាននាំចេញ',
      exportedDetail: 'បាននាំចេញ Excel វេនដោយជោគជ័យ។',
      exportFailedTitle: 'នាំចេញមិនបានសម្រេច',
      exportFailedDetail: 'នាំចេញវេនមិនបានសម្រេច។',
    },

    import: {
      title: 'នាំចូលវេន',
      guideTitle: 'ការណែនាំនាំចូល',
      guideStep1: 'ទាញយកឯកសារគំរូ។',
      guideStep2: 'បំពេញទិន្នន័យវេនតាមទម្រង់ដូចគ្នា។',
      guideStep3: 'ប្រើ DAY ឬ NIGHT សម្រាប់ប្រភេទវេន។',
      guideStep4:
        'ប្រើទម្រង់ HH:mm សម្រាប់ Start Time, Break Start Time, Break End Time និង End Time។',
      guideStep5: 'ជ្រើសឯកសារ Excel ដែលបានបំពេញ ហើយចុច នាំចូល។',

      downloadSample: 'ទាញយកគំរូ',
      sampleDownloaded: 'បានទាញយកឯកសារគំរូដោយជោគជ័យ។',

      fileLabel: 'ឯកសារ Excel',
      chooseFile: 'ជ្រើសឯកសារ',
      noFileSelected: 'មិនទាន់ជ្រើសឯកសារ',

      invalidExcelData: 'ទិន្នន័យ Excel មិនត្រឹមត្រូវ',
      importApiNotFound: 'រកមិនឃើញ API នាំចូល',
      duplicateData: 'ទិន្នន័យស្ទួន',
      serverError: 'បញ្ហា Server',

      helpCodeRequired: 'សូមបញ្ចូលកូដវេន។',
      helpType: 'ប្រភេទវេនត្រូវតែជា DAY ឬ NIGHT។',
      helpStartTime: 'Start Time ត្រូវប្រើទម្រង់ HH:mm ឧទាហរណ៍ 07:00។',
      helpBreakStartTime:
        'Break Start Time ត្រូវប្រើទម្រង់ HH:mm ឧទាហរណ៍ 12:00។',
      helpBreakEndTime:
        'Break End Time ត្រូវប្រើទម្រង់ HH:mm ឧទាហរណ៍ 13:00។',
      helpEndTime: 'End Time ត្រូវប្រើទម្រង់ HH:mm ឧទាហរណ៍ 16:00។',
      helpCrossMidnight:
        'វេនថ្ងៃមិនអាចឆ្លងរាត្រីបានទេ។ វេនយប់ត្រូវតែឆ្លងរាត្រី។',
      helpBreakInside: 'ពេលសម្រាកត្រូវស្ថិតក្នុងម៉ោងធ្វើការរបស់វេន។',
      helpDuplicateCode:
        'កូដវេនត្រូវតែ unique។ សូមប្ដូរកូដដែលស្ទួន។',

      toast: {
        invalidFileTitle: 'ប្រភេទឯកសារមិនត្រឹមត្រូវ',
        invalidFileDetail:
          'សូមជ្រើសតែឯកសារ Excel៖ .xlsx, .xls ឬ .csv។',

        importFailedTitle: 'នាំចូលមិនបានសម្រេច',
        importFailedDetail: 'នាំចូលវេនមិនបានសម្រេច។',

        importedTitle: 'បាននាំចូល',
        importedDetail:
          'នាំចូលបានបញ្ចប់។ សរុប៖ {total}, បានបង្កើត៖ {created}, បានធ្វើបច្ចុប្បន្នភាព៖ {updated}។',
      },

      success: {
        completed: 'នាំចូលវេនបានបញ្ចប់ដោយជោគជ័យ។',
      },

      error: {
        invalidStatus: 'ស្ថានភាពត្រូវតែ Active ឬ Inactive។',
        rowInvalid: 'ទិន្នន័យវេនមិនត្រឹមត្រូវ។',
        duplicateShiftId: 'Shift ID ស្ទួនក្នុងឯកសារនាំចូល។',
        duplicateCode: 'Shift Code ស្ទួនក្នុងឯកសារនាំចូល។',
        shiftIdNotFound: 'រកមិនឃើញ Shift ID។',
      },
    },

    validation: {
      shiftIdInvalid: 'Shift ID មិនត្រឹមត្រូវ។',
      codeRequired: 'ត្រូវការកូដវេន។',
      codeTooLong: 'កូដវេនមិនត្រូវលើស 30 តួអក្សរ។',
      nameRequired: 'ត្រូវការឈ្មោះវេន។',
      nameTooLong: 'ឈ្មោះវេនមិនត្រូវលើស 120 តួអក្សរ។',
      typeInvalid: 'ប្រភេទវេនត្រូវតែជា DAY ឬ NIGHT។',
      startTimeInvalid: 'ម៉ោងចាប់ផ្តើមត្រូវប្រើទម្រង់ HH:mm។',
      breakStartTimeInvalid: 'ម៉ោងចាប់ផ្តើមសម្រាកត្រូវប្រើទម្រង់ HH:mm។',
      breakEndTimeInvalid: 'ម៉ោងបញ្ចប់សម្រាកត្រូវប្រើទម្រង់ HH:mm។',
      endTimeInvalid: 'ម៉ោងបញ្ចប់ត្រូវប្រើទម្រង់ HH:mm។',
      endTimeRequired: 'ត្រូវការម៉ោងបញ្ចប់វេន។',
      isActiveInvalid: 'ស្ថានភាពមិនត្រឹមត្រូវ។',
      updatePayloadRequired: 'សូមធ្វើបច្ចុប្បន្នភាពយ៉ាងហោចណាស់មួយវាល។',
    },

    error: {
      notFound: 'រកមិនឃើញវេន។',
      inactive: 'វេនមិនសកម្ម។',
      codeExists: 'កូដវេនមានរួចហើយ។',
      startEndSame: 'ម៉ោងចាប់ផ្តើម និងបញ្ចប់វេនមិនអាចដូចគ្នាបានទេ។',
      breakStartEndSame:
        'ម៉ោងចាប់ផ្តើមសម្រាក និងបញ្ចប់សម្រាកមិនអាចដូចគ្នាបានទេ។',
      dayCannotCrossMidnight: 'វេនថ្ងៃមិនអាចឆ្លងរាត្រីបានទេ។',
      nightMustCrossMidnight: 'វេនយប់ត្រូវតែឆ្លងរាត្រី។',
      breakEndBeforeStart:
        'ម៉ោងបញ្ចប់សម្រាកត្រូវយឺតជាងម៉ោងចាប់ផ្តើមសម្រាក។',
      breakOutsideShift: 'ពេលសម្រាកត្រូវនៅក្នុងម៉ោងធ្វើការរបស់វេន។',
      excelFileRequired: 'ត្រូវការឯកសារ Excel។',
      excelNoRows: 'ឯកសារ Excel គ្មានទិន្នន័យជួរ។',
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
      guideStep3: 'បំពេញតែ Employee ID, Clock In និង Clock Out ឱ្យដូចគំរូ។',
      guideStep4: 'ជ្រើសឯកសារ ហើយនាំចូល។ បើមានស្ទួន ឬកំហុស ប្រព័ន្ធនឹងបដិសេធទាំងអស់ ហើយឯកសារនេះនឹងជំនួសវត្តមានថ្ងៃដែលបានជ្រើស។',
      note:
        'កាលបរិច្ឆេទវត្តមានជ្រើសនៅក្នុង dialog។ Excel គំរូមិនចាំបាច់មានជួរកាលបរិច្ឆេទទេ។ ការនាំចូលនឹងជំនួសវត្តមានថ្ងៃដែលបានជ្រើស ដូច្នេះបុគ្គលិកដែលមិនមាននៅក្នុងឯកសារថ្មីនឹងត្រូវដកចេញសម្រាប់ថ្ងៃនោះ។',

      downloadSample: 'ទាញយកគំរូ',
      sampleDownloaded: 'បានទាញយកឯកសារគំរូដោយជោគជ័យ។',
      downloadFailed: 'ទាញយកមិនបានសម្រេច',

      importCompleted: 'នាំចូលបានបញ្ចប់',
      importCompletedSuccess: 'នាំចូលវត្តមានបានជោគជ័យ។',
      importCompletedPartial:
        'នាំចូលវត្តមានបាន ប៉ុន្តែមានជួរខ្លះត្រូវរំលង ឬមិនត្រឹមត្រូវ។',
      importFailed: 'នាំចូលមិនបានសម្រេច',

      validation: 'ការផ្ទៀងផ្ទាត់',
      invalidFile: 'ឯកសារមិនត្រឹមត្រូវ',
      invalidExcelData: 'ទិន្នន័យ Excel មិនត្រឹមត្រូវ',
      importApiNotFound: 'រកមិនឃើញ API នាំចូល',
      duplicateData: 'ទិន្នន័យស្ទួន',
      serverError: 'បញ្ហា Server',

      chooseExcelFile: 'សូមជ្រើសឯកសារ Excel។',
      invalidExcelFile:
        'សូម Upload តែឯកសារ Excel៖ .xlsx, .xls ឬ .csv។',
      fileTooLarge: 'ទំហំឯកសារមិនត្រូវលើស 10 MB។',
      selectAttendanceDate: 'សូមជ្រើសកាលបរិច្ឆេទវត្តមាន។',
      failedDownloadSample: 'ទាញយកឯកសារគំរូមិនបានសម្រេច។',
      failedImportFile: 'នាំចូលឯកសារវត្តមានមិនបានសម្រេច។',

      checkEmployeeMaster: 'សូមពិនិត្យ Master Data បុគ្គលិក។',
      checkShiftMaster: 'សូមពិនិត្យ Master Data វេន។',
      dateFormatHelp: 'សូមពិនិត្យទម្រង់កាលបរិច្ឆេទក្នុងឯកសារ Excel។',
      timeFormatHelp: 'សូមប្រើទម្រង់ HH:mm សម្រាប់តម្លៃពេលវេលា។',

      excelFile: 'ឯកសារ Excel',
      chooseFile: 'ជ្រើសឯកសារ',
      noFileSelected: 'មិនទាន់ជ្រើសឯកសារ',
    },

    import: {
      importAttendance: 'នាំចូលវត្តមាន',
      latestImportResult: 'លទ្ធផលនាំចូលចុងក្រោយ',
      latestImportDescription:
        'ឯកសារដែលបាន Upload ចុងក្រោយត្រូវបានដំណើរការដោយ Backend import engine។',
      failedRowPreview: 'មើលជួរបរាជ័យជាមុន',
      importHistory: 'ប្រវត្តិនាំចូល',
      importDetail: 'ព័ត៌មានលម្អិតនាំចូលវត្តមាន',
      loadingImportDetail: 'កំពុងផ្ទុកព័ត៌មានលម្អិតនាំចូល...',
      noImportDetail: 'រកមិនឃើញព័ត៌មានលម្អិត។',
      noImportRecords: 'គ្មានកំណត់ត្រានាំចូលក្នុងព័ត៌មានលម្អិតនេះ។',
      noImports: 'គ្មានការនាំចូលវត្តមានត្រូវនឹងលក្ខខណ្ឌស្វែងរក។',
      detailLoadFailed: 'ផ្ទុកព័ត៌មានលម្អិតនាំចូលវត្តមានមិនបានសម្រេច។',
    },

    records: {
      attendanceList: 'បញ្ជីវត្តមាន',
      noRecords: 'គ្មានកំណត់ត្រាវត្តមានត្រូវនឹងលក្ខខណ្ឌស្វែងរក។',
      loadFailed: 'ផ្ទុកកំណត់ត្រាវត្តមានមិនបានសម្រេច។',
    },

    field: {
      attendanceDate: 'កាលបរិច្ឆេទវត្តមាន',
      selectAttendanceDate: 'ជ្រើសកាលបរិច្ឆេទវត្តមាន',

      importNo: 'លេខនាំចូល',
      fileName: 'ឈ្មោះឯកសារ',
      period: 'រយៈពេល',
      periodFrom: 'រយៈពេលចាប់ពី',
      periodTo: 'រយៈពេលដល់',
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

      scanIn: 'Scan In',
      scanOut: 'Scan Out',
      clockIn: 'Clock In',
      clockOut: 'Clock Out',

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

      searchImportPlaceholder: 'ស្វែងរកលេខនាំចូល ឈ្មោះឯកសារ ឬកំណត់ចំណាំ',
      searchRecordsPlaceholder: 'ស្វែងរកបុគ្គលិក ឈ្មោះនាំចូល ឬមូលហេតុ',
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
      partialSuccess: 'ជោគជ័យខ្លះ',
      failed: 'បរាជ័យ',

      present: 'មានវត្តមាន',
      late: 'យឺត',
      absent: 'អវត្តមាន',
      forgetScanIn: 'ភ្លេច Scan In',
      forgetScanOut: 'ភ្លេច Scan Out',
      shiftMismatch: 'វេនមិនត្រូវ',
      leave: 'ច្បាប់',
      off: 'ឈប់',
      unknown: 'មិនស្គាល់',

      valid: 'ត្រឹមត្រូវ',
      imported: 'បាននាំចូល',
      error: 'បញ្ហា',
      invalid: 'មិនត្រឹមត្រូវ',
      warning: 'ការព្រមាន',
      duplicate: 'ស្ទួន',
      pending: 'កំពុងរង់ចាំ',
      cancelled: 'បានបោះបង់',
      draft: 'ព្រាង',

      matched: 'ផ្គូផ្គង',
      mismatch: 'មិនផ្គូផ្គង',

      workingDay: 'ថ្ងៃធ្វើការ',
      sunday: 'ថ្ងៃអាទិត្យ',
      holiday: 'ថ្ងៃឈប់សម្រាក',
      missing: 'ខ្វះ',
    },

    message: {
      loadFailed: 'ផ្ទុកមិនបានសម្រេច',
      detailLoadFailed: 'ផ្ទុកព័ត៌មានលម្អិតមិនបានសម្រេច',
      missingImportId: 'ខ្វះលេខសម្គាល់នាំចូល',
      missingImportIdDetail:
        'មិនអាចបើកព័ត៌មានលម្អិតនាំចូលនេះបានទេ ព្រោះខ្វះ ID។',
      noDataFound: 'រកមិនឃើញទិន្នន័យ',
      updating: 'កំពុងធ្វើបច្ចុប្បន្នភាព',
      failedRowsWarning:
        'ជួរខ្លះបរាជ័យ ឬត្រូវបានរំលង។ សូមពិនិត្យបញ្ជីជួរបរាជ័យខាងក្រោម។',
      partialImportWarning:
        'វត្តមានត្រូវបាននាំចូល ប៉ុន្តែមានជួរខ្លះត្រូវបានរំលង ស្ទួន ឬមិនត្រឹមត្រូវ។',
    },

    result: {
      employee_not_matched: 'បុគ្គលិកមិនផ្គូផ្គងជាមួយ Employee master។',
      leave: 'ស្ថានភាពនាំចូលជា Leave ហើយគ្មាន punch។',
      off: 'ស្ថានភាពនាំចូលជា Off ហើយគ្មាន punch។',
      absent: 'គ្មាន clock in និង clock out។',
      forget_scan_in: 'មាន clock out ប៉ុន្តែខ្វះ clock in។',
      forget_scan_out: 'មាន clock in ប៉ុន្តែខ្វះ clock out។',
      shift_mismatch: 'ពេល punch មិនត្រូវនឹងវេនដែលបានកំណត់។',
      late: 'Clock in យឺតជាងម៉ោងចាប់ផ្តើមវេន។',
      present: 'Clock in/out ត្រូវនឹងវេនដែលបានកំណត់។',
      unknown: 'មិនអាចគណនាលទ្ធផលវត្តមានបានទេ។',
      invalid_clock_format: 'ទម្រង់ clock in/out មិនត្រឹមត្រូវ។',
      invalid_shift_time: 'ម៉ោងវេនដែលបានកំណត់ខ្វះ ឬមិនត្រឹមត្រូវ។',
    },

    verification: {
      otDate: 'កាលបរិច្ឆេទ OT',
      selectOtDate: 'ជ្រើសកាលបរិច្ឆេទ OT',
      searchOtRequest: 'ស្វែងរកសំណើ OT',
      selectOtRequest: 'ជ្រើសសំណើ OT',
      requestStatus: 'ស្ថានភាពសំណើ',
      results: 'លិទ្ធផល',

      allResults: 'លទ្ធផលទាំងអស់',
      matched: 'ផ្គូផ្គង',
      acceptedByPolicy: 'ទទួលយកដោយគោលការណ៍',
      needsCheck: 'ត្រូវពិនិត្យ',
      forgetScanIn: 'ភ្លេច Scan In',
      forgetScanOut: 'ភ្លេច Scan Out',
      otStaffAbsent: 'បុគ្គលិក OT អវត្តមាន',
      wrongShift: 'វេនខុស',
      notInOtStaff: 'មិនស្ថិតក្នុងបុគ្គលិក OT',
      notEligible: 'មិនមានសិទ្ធិ',

      requestStaff: 'បុគ្គលិកក្នុងសំណើ',
      forgetIn: 'ភ្លេច In',
      forgetOut: 'ភ្លេច Out',
      absent: 'អវត្តមាន',
      notInOt: 'មិនស្ថិតក្នុង OT',

      nonFinalWarning:
        'សំណើ OT នេះកំពុងស្ថិតក្នុងស្ថានភាព {status}។ អ្នកអាចផ្ទៀងផ្ទាត់សម្រាប់ពិនិត្យ ប៉ុន្តែការទូទាត់ OT ចុងក្រោយគួរតែផ្អែកលើសំណើដែលបានអនុម័តចុងក្រោយ។',

      requestNo: 'លេខសំណើ',
      requester: 'អ្នកស្នើ',
      shift: 'វេន',
      expectedOt: 'OT រំពឹងទុក',
      requested: 'បានស្នើ',
      policy: 'គោលការណ៍',

      verificationResult: 'លទ្ធផលផ្ទៀងផ្ទាត់',
      loadingVerification: 'កំពុងផ្ទុកការផ្ទៀងផ្ទាត់វត្តមាន OT...',
      rowCount: '{count} ជួរ',
      searchPlaceholder: 'ស្វែងរកបុគ្គលិក លទ្ធផល ឬមូលហេតុ',

      resultLabel: 'លទ្ធផល',
      meaning: 'អត្ថន័យ',
      employee: 'បុគ្គលិក',
      otType: 'ប្រភេទ OT',
      scanIn: 'Scan In',
      scanOut: 'Scan Out',
      status: 'ស្ថានភាព',
      creditedOt: 'OT ដែលគិត',
      actual: 'ជាក់ស្តែង',
      reason: 'មូលហេតុ',

      fixedOt: 'Fixed OT',
      afterShift: 'ក្រោយវេន',
      otOption: 'ជម្រើស OT',

      noVerificationRows: 'រកមិនឃើញជួរផ្ទៀងផ្ទាត់។',
      emptyInstruction:
        'ជ្រើសកាលបរិច្ឆេទ OT ជ្រើសសំណើ OT បន្ទាប់មកផ្ទៀងផ្ទាត់លទ្ធផលវត្តមាន។',

      otDateRequired: 'ត្រូវការកាលបរិច្ឆេទ OT',
      otDateRequiredDetail: 'សូមជ្រើសកាលបរិច្ឆេទ OT ជាមុន។',
      noOtRequests: 'គ្មានសំណើ OT',
      noOtRequestsDetail:
        'រកមិនឃើញសំណើ OT សម្រាប់កាលបរិច្ឆេទ និងស្ថានភាពដែលបានជ្រើស។',
      loadFailed: 'ផ្ទុកមិនបានសម្រេច',
      loadVerificationFailed: 'ផ្ទុកការផ្ទៀងផ្ទាត់វត្តមាន OT មិនបានសម្រេច។',
      loadRequestsFailed: 'ផ្ទុកសំណើ OT មិនបានសម្រេច។',

      noRequestNo: 'គ្មានលេខសំណើ',
      statusPrefix: 'ស្ថានភាព',
      staff: 'បុគ្គលិក',

      result: {
        match: 'ផ្គូផ្គង',
        mismatch: 'ត្រូវពិនិត្យ',
        pending_review: 'រង់ចាំពិនិត្យ',
      },

      no_paid_ot_minutes: 'រកមិនឃើញនាទី OT ដែលត្រូវបង់ក្នុងសំណើ OT ដែលបានអនុម័ត។',
      approved_without_exact_clock_out:
        'OT ដែលបានអនុម័តត្រូវបានគិតតាមគោលការណ៍។ បុគ្គលិកមានវត្តមានក្នុងវេនធម្មតា។ មិនចាំបាច់មាន scan ចេញ OT ត្រឹមត្រូវពេញលេញទេ។',
      approved_without_exact_clock_out_late:
        'OT ដែលបានអនុម័តត្រូវបានគិតតាមគោលការណ៍។ បុគ្គលិកយឺត ប៉ុន្តែមានវត្តមានក្នុងវេនធម្មតា។ មិនចាំបាច់មាន scan ចេញ OT ត្រឹមត្រូវពេញលេញទេ។',
      fixed_ot_approved_without_exact_clock_out:
        'Fixed OT ត្រូវបានគិតតាមគោលការណ៍។ បុគ្គលិកមានវត្តមានក្នុងវេនធម្មតា។ មិនចាំបាច់មាន scan ចេញ OT ត្រឹមត្រូវពេញលេញទេ។',
      fixed_ot_approved_without_exact_clock_out_late:
        'Fixed OT ត្រូវបានគិតតាមគោលការណ៍។ បុគ្គលិកយឺត ប៉ុន្តែមានវត្តមានក្នុងវេនធម្មតា។ មិនចាំបាច់មាន scan ចេញ OT ត្រឹមត្រូវពេញលេញទេ។',

      forget_scan_in_pending: 'ភ្លេច Scan In កំពុងរង់ចាំពិនិត្យតាមគោលការណ៍ OT។',
      forget_scan_out_pending: 'ភ្លេច Scan Out កំពុងរង់ចាំពិនិត្យតាមគោលការណ៍ OT។',
      attendance_not_present:
        'OT ដែលបានអនុម័តមិនត្រូវបានគិតទេ ព្រោះវត្តមានមិនមែន Present។',
      status_requires_manual_review:
        'ស្ថានភាពវត្តមានត្រូវការពិនិត្យដោយដៃ មុនពេលអាចគិត OT។',

      no_request_window: 'ចន្លោះពេលសំណើ OT ខ្វះ ឬមិនត្រឹមត្រូវ។',
      no_attendance_window: 'ចន្លោះ clock in/out ខ្វះ ឬមិនត្រឹមត្រូវ។',

      sunday_holiday_no_overlap:
        'ពេលវត្តមានមិនជាន់គ្នាជាមួយសំណើ OT ថ្ងៃអាទិត្យ ឬថ្ងៃឈប់សម្រាក។',
      sunday_holiday_below_min:
        'OT ថ្ងៃអាទិត្យ ឬថ្ងៃឈប់សម្រាកតិចជាងនាទីអប្បបរមាដែលអាចទទួលបាន។',
      sunday_holiday_match:
        'OT ថ្ងៃអាទិត្យ ឬថ្ងៃឈប់សម្រាកផ្គូផ្គងនឹងសំណើដែលបានអនុម័ត។',
      sunday_holiday_short:
        'OT ថ្ងៃអាទិត្យ ឬថ្ងៃឈប់សម្រាកខ្លីជាងសំណើដែលបានអនុម័ត។',
      sunday_holiday_exceed:
        'OT ថ្ងៃអាទិត្យ ឬថ្ងៃឈប់សម្រាកលើសសំណើដែលបានអនុម័ត។',

      policy_not_eligible: 'OT មិនមានសិទ្ធិតាមគោលការណ៍ដែលបានជ្រើស។',
      policy_below_min: 'OT តិចជាងនាទីអប្បបរមាក្នុងគោលការណ៍។',
      policy_match: 'OT ផ្គូផ្គងនឹងសំណើដែលបានអនុម័តតាមគោលការណ៍។',
      policy_short: 'OT ដែលគិតបានតិចជាងសំណើដែលបានអនុម័តតាមគោលការណ៍។',
      policy_exceed: 'OT ដែលគិតបានលើសសំណើដែលបានអនុម័តតាមគោលការណ៍។',

      meaningLabel: {
        forgetScanIn: 'ភ្លេច Scan In',
        forgetScanOut: 'ភ្លេច Scan Out',
        acceptedByPolicy: 'ទទួលយកដោយគោលការណ៍',
        otStaffAbsent: 'បុគ្គលិក OT អវត្តមាន',
        wrongShift: 'វេនខុស',
        notInOtStaff: 'មិនស្ថិតក្នុងបុគ្គលិក OT',
        notEligible: 'មិនមានសិទ្ធិ OT',
        otMatchedRequest: 'OT ផ្គូផ្គងសំណើ',
        absent: 'អវត្តមាន',
        missingScanTime: 'ខ្វះពេល Scan',
        noCreditedOt: 'គ្មាន OT ដែលគិត',
        creditedLessThanRequest: 'គិតបានតិចជាងសំណើ',
        creditedOverRequest: 'គិតបានលើសសំណើ',
        adjustedByRule: 'បានកែតាមច្បាប់',
        checkOtRule: 'ពិនិត្យច្បាប់ OT',
      },
    },

    validation: {
      invalidId: 'លេខសម្គាល់មិនត្រឹមត្រូវ។',
      dateYmd: 'កាលបរិច្ឆេទត្រូវតែមានទម្រង់ YYYY-MM-DD។',
      attendanceDateRequired: 'ត្រូវការកាលបរិច្ឆេទវត្តមាន។',
      attendanceDateToAfterFrom:
        'Attendance date to ត្រូវធំជាង ឬស្មើ Attendance date from។',
      periodToAfterFrom:
        'Period to ត្រូវធំជាង ឬស្មើ Period from។',
      otDateToAfterFrom:
        'OT date to ត្រូវធំជាង ឬស្មើ OT date from។',
    },

    error: {
      importFileRequired: 'ត្រូវការឯកសារ Excel វត្តមាន។',
      importFileInvalid: 'ឯកសារវត្តមានទទេ ឬមិនត្រឹមត្រូវ។',
      unableToReadFile: 'មិនអាចអានឯកសារវត្តមានបានទេ។',
      worksheetMissing: 'ឯកសារវត្តមានគ្មាន worksheet។',
      worksheetEmpty: 'worksheet វត្តមានទទេ។',
      headerMissing: 'រកមិនឃើញជួរចំណងជើងក្នុង worksheet វត្តមាន។',
      employeeIdColumnRequired:
        'ឯកសារវត្តមានត្រូវមានជួរ Employee ID។',
      clockInColumnRequired:
        'ឯកសារវត្តមានត្រូវមានជួរ Clock In។',
      clockOutColumnRequired:
        'ឯកសារវត្តមានត្រូវមានជួរ Clock Out។',
      importNotFound: 'រកមិនឃើញការនាំចូលវត្តមាន។',
      recordNotFound: 'រកមិនឃើញកំណត់ត្រាវត្តមាន។',
      otRequestNotFound: 'រកមិនឃើញសំណើ OT។',
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
      pendingRequesterConfirmation: 'រង់ចាំអ្នកស្នើបញ្ជាក់',
      approved: 'បានអនុម័ត',
      rejected: 'បានបដិសេធ',
      requesterDisagreed: 'អ្នកស្នើមិនយល់ព្រម',
      cancelled: 'បានបោះបង់',
    },

    approvalDisplay: {
      approved: 'បានអនុម័ត',
      rejected: 'បានបដិសេធ',
      waitingRequesterConfirmation: 'កំពុងរង់ចាំអ្នកស្នើបញ្ជាក់',
      requesterDisagreed: 'អ្នកស្នើមិនយល់ព្រម',
      cancelled: 'បានបោះបង់',
      waitingApproval: 'កំពុងរង់ចាំអនុម័ត',
    },

    acknowledgement: {
      status: {
        acknowledged: 'បានទទួលដឹង',
        waiting: 'កំពុងរង់ចាំ',
        pending: 'កំពុងរង់ចាំ',
        fyi: 'ជូនដំណឹង',
      },
    },

    acknowledge: {
      inbox: 'ប្រអប់ទទួលដឹង OT',
      loading: 'កំពុងផ្ទុកប្រអប់ទទួលដឹង',
      fetchingRecords: 'កំពុងទាញយកសំណើ OT សម្រាប់ទទួលដឹង...',
      noData: 'រកមិនឃើញសំណើទទួលដឹង។',
      loadFailed: 'ផ្ទុកប្រអប់ទទួលដឹងមិនបានសម្រេច។',
      acknowledgement: 'ការទទួលដឹង',
      requestStatus: 'ស្ថានភាពសំណើ',
      fyi: 'ជូនដំណឹង',
    },

    approval: {
      inbox: 'ប្រអប់អនុម័ត OT',
      approvalStatus: 'ស្ថានភាពអនុម័ត',
      staffCount: 'បុគ្គលិក {count}',
      time: 'ពេលវេលា',

      exportExcel: 'នាំចេញ Excel',
      approveSelected: 'អនុម័តដែលបានជ្រើស',
      approveSelectedWithCount: 'អនុម័តដែលបានជ្រើស ({count})',
      clearSelection: 'សម្អាតការជ្រើស',

      loading: 'កំពុងផ្ទុកប្រអប់អនុម័ត',
      fetchingRecords: 'កំពុងទាញយកសំណើអនុម័ត OT...',
      noData: 'រកមិនឃើញសំណើអនុម័ត OT។',
      loadFailed: 'ផ្ទុកប្រអប់អនុម័តមិនបានសម្រេច។',

      exported: 'បាននាំចេញ',
      exportedSuccess: 'បាននាំចេញ Excel ប្រអប់អនុម័តដោយជោគជ័យ។',
      exportFailed: 'នាំចេញមិនបានសម្រេច',

      requestedStaff: 'បុគ្គលិកដែលបានស្នើ',
      requested: 'បានស្នើ',
      breakTime: 'ពេលសម្រាក',
      totalRequestPaid: 'សរុបដែលស្នើបង់',
      paid: 'បានបង់',
      totalPaid: 'សរុបបានបង់',

      legacyManual: 'Manual ចាស់',
      shiftOption: 'ជម្រើសវេន',

      noSelectedRequests: 'មិនទាន់ជ្រើសសំណើ',
      selectAtLeastOne: 'សូមជ្រើសសំណើ OT ដែលអាចអនុម័តយ៉ាងហោចណាស់មួយ។',

      decisionEyebrow: 'ការសម្រេចអនុម័ត OT',
      confirmApproval: 'បញ្ជាក់ការអនុម័ត',
      rejectRequest: 'បដិសេធសំណើ OT',
      approveQuestion: 'តើអ្នកប្រាកដថាចង់អនុម័តមែនទេ?',
      rejectQuestion: 'តើអ្នកប្រាកដថាចង់បដិសេធមែនទេ?',
      approveHelp: 'វានឹងអនុម័តបុគ្គលិកទាំងអស់ក្នុងសំណើ OT នេះ។',
      rejectHelp: 'វានឹងបដិសេធសំណើ OT ទាំងមូល។',

      remark: 'កំណត់ចំណាំ',
      optionalApprovalRemark: 'កំណត់ចំណាំអនុម័ត ប្រសិនបើមាន',
      rejectionReasonPlaceholder: 'សូមបញ្ចូលមូលហេតុបដិសេធ',
      rejectionRemarkRequired: 'សូមបញ្ចូលកំណត់ចំណាំបដិសេធ។',
      yesApprove: 'បាទ/ចាស អនុម័ត',

      decisionSuccess: 'ជោគជ័យ',
      approveSuccess: 'បានអនុម័តសំណើ OT ដោយជោគជ័យ។',
      rejectSuccess: 'បានបដិសេធសំណើ OT ដោយជោគជ័យ។',
      decisionFailed: 'សម្រេចមិនបានសម្រេច',

      bulkApproval: 'អនុម័តច្រើន',
      approveMultiple: 'អនុម័តសំណើ OT ច្រើន',
      requestCount: 'សំណើ {count}',
      bulkWarning:
        'តើអ្នកប្រាកដថាចង់អនុម័តសំណើ OT ដែលបានជ្រើសមែនទេ? វានឹងអនុម័តបុគ្គលិកទាំងអស់ក្នុងសំណើនីមួយៗ។',
      bulkRemarkPlaceholder: 'កំណត់ចំណាំសម្រាប់ការអនុម័តទាំងអស់ ប្រសិនបើមាន',
      approveAllSelected: 'អនុម័តទាំងអស់ដែលបានជ្រើស',

      bulkCompleted: 'អនុម័តច្រើនបានបញ្ចប់',
      bulkPartial: 'បានអនុម័ត {success}, បរាជ័យ {failed}។',
      bulkSuccess: 'បានអនុម័តសំណើ {count} ដោយជោគជ័យ។',
      bulkFailed: 'អនុម័តច្រើនមិនបានសម្រេច',
      bulkNoApproved: 'គ្មានសំណើណាមួយត្រូវបានអនុម័ត។',
    },

    requests: {
      tableTitle: 'សំណើ OT របស់ខ្ញុំ',
      title: 'សំណើ OT របស់ខ្ញុំ',
      createTitle: 'បង្កើតសំណើ OT',
      editTitle: 'កែប្រែសំណើ OT',
      detailTitle: 'ព័ត៌មានលម្អិតសំណើ OT',
      approvalTitle: 'ប្រអប់អនុម័ត OT',
      acknowledgeTitle: 'ប្រអប់ទទួលដឹង OT',
      subtitle: 'មើល និងគ្រប់គ្រងតែសំណើ OT ដែលអ្នកបានបង្កើត។',

      requestNo: 'លេខសំណើ',
      otDate: 'កាលបរិច្ឆេទ OT',
      otDateFrom: 'OT ចាប់ពីថ្ងៃ',
      otDateTo: 'OT ដល់ថ្ងៃ',
      otTime: 'ម៉ោង OT',
      time: 'ពេលវេលា',
      dayType: 'ប្រភេទថ្ងៃ',
      otOption: 'ជម្រើស OT',

      employee: 'បុគ្គលិក',
      employees: 'បុគ្គលិក',
      approver: 'អ្នកអនុម័ត',
      requester: 'អ្នកស្នើ',
      requestedMinutes: 'នាទីដែលបានស្នើ',
      paidMinutes: 'នាទីដែលត្រូវបង់',
      breakMinutes: 'នាទីសម្រាក',
      break: 'សម្រាក',
      total: 'សរុប',
      mode: 'របៀប',

      exportExcel: 'នាំចេញ Excel',
      newRequest: 'សំណើ OT ថ្មី',

      deleteConfirmTitle: 'លុបសំណើ OT',
      deleteConfirmHeading: 'លុបសំណើ OT នេះជាអចិន្ត្រៃយ៍?',
      deleteConfirmHelp:
        'វានឹងលុបសំណើ OT និងការជូនដំណឹងដែលពាក់ព័ន្ធជាអចិន្ត្រៃយ៍។ ប្រើសម្រាប់ទិន្នន័យសាកល្បង ឬទិន្នន័យដែលបានយល់ព្រមសម្អាតប៉ុណ្ណោះ។',
      deletedSuccess: 'បានលុបសំណើ OT ដោយជោគជ័យ។',
      deleteFailed: 'លុបមិនបានសម្រេច។',

      allDayTypes: 'ប្រភេទថ្ងៃទាំងអស់',

      loading: 'កំពុងផ្ទុកសំណើ OT របស់ខ្ញុំ',
      fetchingRecords: 'កំពុងទាញយកកំណត់ត្រាសំណើ OT របស់ខ្ញុំ...',
      noData: 'រកមិនឃើញសំណើ OT របស់អ្នក។',
      loadFailed: 'ផ្ទុកសំណើ OT របស់ខ្ញុំមិនបានសម្រេច។',

      exported: 'ឯកសារត្រៀមរួច',
      exportedSuccess: 'បានទាញយកឯកសារ Excel សំណើ OT របស់ខ្ញុំដោយជោគជ័យ។',
      exportFailed: 'នាំចេញមិនបានសម្រេច',

      approvalStatus: 'ស្ថានភាពអនុម័ត',
      staff: 'បុគ្គលិក',
      staffCount: 'បុគ្គលិក {count}',
      timing: 'ពេលវេលា',
      verify: 'ផ្ទៀងផ្ទាត់',

      preset: 'Preset',
      customFixed: 'Custom',

      defaultRequestTime: 'ពេលសំណើលំនាំដើម',
      employeeId: 'ID',
      noEmployeeData: 'រកមិនឃើញទិន្នន័យបុគ្គលិកសម្រាប់សំណើនេះ។',

      timeMode: {
        default: 'លំនាំដើម',
        custom: 'កំណត់ផ្ទាល់',
      },

      edit: {
        title: 'កែប្រែសំណើ OT',
        subtitle:
          'អ្នកស្នើអាចកែប្រែបានតែមុនពេលជំហានអនុម័តណាមួយត្រូវបានអនុម័ត។',
        saveChanges: 'រក្សាទុកការផ្លាស់ប្តូរ',

        loadingDetail: 'កំពុងផ្ទុកសំណើ OT...',
        notFound: 'រកមិនឃើញសំណើ OT។',

        legacyManualMode: 'Legacy Manual Mode',
        shiftOtOptionMode: 'Shift OT Option Mode',

        editForm: 'Form កែប្រែ',
        currentSummary: 'សេចក្តីសង្ខេបបច្ចុប្បន្ន',
        employeesInRequest: 'បុគ្គលិកក្នុងសំណើនេះ',

        requesterId: 'Requester ID',
        startTime: 'ម៉ោងចាប់ផ្តើម',
        endTime: 'ម៉ោងបញ្ចប់',
        reason: 'មូលហេតុ',
        approverChain: 'ខ្សែសង្វាក់អ្នកអនុម័ត',
        selectApprovers: 'ជ្រើសអ្នកអនុម័តតាមលំដាប់គ្រប់គ្រង',
        selectOtOption: 'ជ្រើសជម្រើស OT',

        shiftType: 'ប្រភេទវេន',
        shiftStart: 'ចាប់ផ្តើមវេន',
        shiftEnd: 'បញ្ចប់វេន',

        requestedDuration: 'រយៈពេលដែលបានស្នើ',
        requestStart: 'ចាប់ផ្តើមសំណើ',
        requestEnd: 'បញ្ចប់សំណើ',

        currentRequestTime: 'ពេលសំណើបច្ចុប្បន្ន',
        currentTotalHours: 'ម៉ោងសរុបបច្ចុប្បន្ន',
        currentOtOption: 'ជម្រើស OT បច្ចុប្បន្ន',

        employeeListNote:
          'កំណែនេះរក្សាបញ្ជីបុគ្គលិកបច្ចុប្បន្ន ហើយកែប្រែព័ត៌មាន OT មូលហេតុ និងខ្សែសង្វាក់អ្នកអនុម័ត។',

        cannotEditMessage:
          'មិនអាចកែប្រែសំណើ OT នេះបានទេ ព្រោះវាមិននៅស្ថានភាពរង់ចាំ ឬមានជំហានអនុម័តរួចហើយ។',

        noShiftOption: 'មិនទាន់មានជម្រើស OT សកម្មសម្រាប់វេននេះទេ។',

        minutesValue: '{value} នាទី',

        validationTitle: 'ការផ្ទៀងផ្ទាត់',
        editUnavailableTitle: 'មិនអាចកែប្រែបាន',
        editUnavailableDetail: 'សំណើ OT នេះមិនអាចកែប្រែបានទៀតទេ។',
        selectDateRequired: 'សូមជ្រើសកាលបរិច្ឆេទ OT។',
        reasonRequired: 'សូមបញ្ចូលមូលហេតុ។',
        employeeRequired: 'ត្រូវការបុគ្គលិកយ៉ាងហោចណាស់ 1 នាក់។',
        approverRequired: 'សូមជ្រើសអ្នកអនុម័តយ៉ាងហោចណាស់ 1 នាក់។',
        approverMax: 'អ្នកអាចជ្រើសអ្នកអនុម័តបានអតិបរមា 4 នាក់ប៉ុណ្ណោះ។',
        startTimeInvalid: 'ម៉ោងចាប់ផ្តើមត្រូវជា HH:mm។',
        endTimeInvalid: 'ម៉ោងបញ្ចប់ត្រូវជា HH:mm។',
        endTimeAfterStart: 'ម៉ោងបញ្ចប់ត្រូវយឺតជាងម៉ោងចាប់ផ្តើម។',
        otOptionRequired: 'សូមជ្រើសជម្រើស OT។',

        optionsFailedTitle: 'ជម្រើស OT បរាជ័យ',
        optionsFailedDetail: 'មិនអាចផ្ទុកជម្រើស OT សម្រាប់វេននេះបានទេ។',
        loadFailedDetail: 'ផ្ទុកសំណើ OT មិនបានសម្រេច។',
        updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពសំណើ OT ដោយជោគជ័យ។',
        updateFailedDetail: 'ធ្វើបច្ចុប្បន្នភាពសំណើ OT មិនបានសម្រេច។',
      },

      create: {
        selectedCount: 'បានជ្រើស {count}',

        selectOtDate: '1. ជ្រើសកាលបរិច្ឆេទ OT',
        timingType: '3. ប្រភេទពេលវេលា',
        presetOption: 'ជម្រើស Preset',
        customFixedTime: 'ពេលវេលា Custom fixed',
        otOptionPolicy: '2. ជ្រើសរើសម៉ោង',
        selectTimingType: 'ជ្រើសប្រភេទពេលវេលា',
        selectOtOption: 'រើសម៉ោង',

        customDefaultTime: 'ពេល OT លំនាំដើម Custom',
        customDefaultTimeHelp:
          'បុគ្គលិកដែលបានជ្រើសទាំងអស់ប្រើពេលនេះ លុះត្រាតែបានកែប្រែក្រោយមក។',
        flexible: 'បត់បែន',

        startTime: 'ម៉ោងចាប់ផ្តើម',
        endTime: 'ម៉ោងបញ្ចប់',
        breakMinutes: 'នាទីសម្រាក',

        timing: 'ពេលវេលា',
        start: 'ចាប់ផ្តើម',
        end: 'បញ្ចប់',
        total: 'សរុប',
        submitRequest: 'ដាក់សំណើ OT',

        reason: '5. មូលហេតុ',
        optional: 'មិនចាំបាច់',
        reasonPlaceholder:
          'ឧទាហរណ៍៖ ការបញ្ជាទិញបន្ទាន់, ថ្ងៃកំណត់ដឹកជញ្ជូន...',

        validationTitle: 'ពិនិត្យ Form',
        waitAvailability: 'សូមរង់ចាំរហូតដល់ពិនិត្យភាពអាចប្រើ OT បានបញ្ចប់។',
        selectDateFirst: 'សូមជ្រើសកាលបរិច្ឆេទ OT ជាមុន។',
        selectAtLeastOneEmployee: 'សូមជ្រើសបុគ្គលិកយ៉ាងហោចណាស់ 1 នាក់។',
        missingShift: 'បុគ្គលិកដែលបានជ្រើសខ្លះមិនមានវេនកំណត់។',
        mixedShift:
          'សូមជ្រើសបុគ្គលិកពីវេនតែមួយប៉ុណ្ណោះ មុនពេលបង្កើតសំណើ OT។',
        selectOtOptionForDayType: 'សូមជ្រើសជម្រើស OT សម្រាប់ {dayType}។',
        selectOtOptionRequired: 'សូមជ្រើសជម្រើស OT។',
        enterCustomStartTime: 'សូមបញ្ចូលម៉ោងចាប់ផ្តើម Custom។',
        enterCustomEndTime: 'សូមបញ្ចូលម៉ោងបញ្ចប់ Custom។',
        customStartInvalid:
          'ម៉ោងចាប់ផ្តើម Custom ត្រូវជា HH:mm ឧទាហរណ៍ 18:00។',
        customEndInvalid:
          'ម៉ោងបញ្ចប់ Custom ត្រូវជា HH:mm ឧទាហរណ៍ 20:00។',
        customTimeInvalid: 'ម៉ោងចាប់ផ្តើម និងបញ្ចប់ Custom ត្រូវជា HH:mm។',
        customTimeSame: 'ម៉ោងចាប់ផ្តើម និងបញ្ចប់ Custom មិនអាចដូចគ្នាបានទេ។',
        breakTooLong:
          'នាទីសម្រាកមិនអាចធំជាង ឬស្មើរយៈពេល OT បានទេ។',
        selectValidTiming: 'សូមជ្រើសពេលវេលា OT ត្រឹមត្រូវ មុនពេលដាក់ស្នើ។',

        missingEmployeeStart: 'ខ្វះម៉ោងចាប់ផ្តើម OT សម្រាប់ {employee}។',
        missingEmployeeEnd: 'ខ្វះម៉ោងបញ្ចប់ OT សម្រាប់ {employee}។',
        employeeStartInvalid: 'ម៉ោងចាប់ផ្តើម OT មិនត្រឹមត្រូវសម្រាប់ {employee}។',
        employeeEndInvalid: 'ម៉ោងបញ្ចប់ OT មិនត្រឹមត្រូវសម្រាប់ {employee}។',
        employeeTimeSame:
          'ម៉ោងចាប់ផ្តើម និងបញ្ចប់ OT មិនអាចដូចគ្នាសម្រាប់ {employee} បានទេ។',
        employeeBreakTooLong:
          'នាទីសម្រាកមិនអាចធំជាង ឬស្មើរយៈពេល OT សម្រាប់ {employee} បានទេ។',

        profileLoadFailed: 'ផ្ទុកប្រវត្តិរូបបរាជ័យ',
        profileLoadFailedDetail: 'មិនអាចផ្ទុកប្រវត្តិបុគ្គលិករបស់អ្នកបានទេ។',

        availabilityFailed: 'ពិនិត្យភាពអាចប្រើ OT បរាជ័យ',
        availabilityFailedDetail:
          'មិនអាចពិនិត្យបុគ្គលិកដែលមាន OT រួចសម្រាប់កាលបរិច្ឆេទនេះបានទេ។',

        optionsFailed: 'ជម្រើស OT បរាជ័យ',
        optionsFailedDetail:
          'មិនអាចផ្ទុកជម្រើស OT សម្រាប់វេន និងកាលបរិច្ឆេទដែលបានជ្រើសបានទេ។',

        noOptionTitle: 'គ្មានជម្រើស OT',
        noOptionForDayType:
          'រកមិនឃើញជម្រើស OT សកម្មសម្រាប់ {dayType}។ សូមស្នើ Admin បង្កើតជម្រើស។',
        noOptionGeneric: 'រកមិនឃើញជម្រើស OT សកម្មសម្រាប់វេន/កាលបរិច្ឆេទនេះ។',

        calendarUnavailableTitle: 'ប្រតិទិនថ្ងៃឈប់សម្រាកមិនអាចប្រើបាន',
        calendarUnavailableDetail:
          'មិនអាចផ្ទុកប្រតិទិនថ្ងៃឈប់សម្រាកខាងក្នុងបានទេ។',

        employeesRemoved: 'បានដកបុគ្គលិកចេញ',
        employeesRemovedDetail:
          'បុគ្គលិក {count} នាក់មានសំណើ OT រួចសម្រាប់ថ្ងៃនេះ ហើយត្រូវបានដកចេញពីការជ្រើស។',

        successTitle: 'បានបង្កើត',
        successMessage: 'បានបង្កើតសំណើ OT ដោយជោគជ័យ។',
        createFailedDetail: 'មិនអាចបង្កើតសំណើ OT បានទេ។',

        duplicateTitle: 'បុគ្គលិក OT ស្ទួន',
        duplicateGeneric: 'បុគ្គលិកខ្លះមានសំណើ OT រួចសម្រាប់ថ្ងៃនេះ។',
        duplicateDetail:
          'បុគ្គលិកទាំងនេះមានសំណើ OT រួចសម្រាប់ថ្ងៃនេះ ហើយត្រូវបានដកចេញពីការជ្រើស៖ {preview}។',
        duplicateDetailMore:
          'បុគ្គលិកទាំងនេះមានសំណើ OT រួចសម្រាប់ថ្ងៃនេះ ហើយត្រូវបានដកចេញពីការជ្រើស៖ {preview}, និង {more} នាក់ទៀត។',

        missingClockInTitle: 'ត្រូវការ attendance time-in',
        todayAttendanceRequired:
          'OT ថ្ងៃនេះត្រូវការវត្តមាន time-in មុនពេលបង្កើតសំណើ។',
        missingClockInDetail:
          'OT ថ្ងៃនេះត្រូវការវត្តមាន time-in។ បានដកចេញពីការជ្រើស៖ {preview}។',
        missingClockInDetailMore:
          'OT ថ្ងៃនេះត្រូវការវត្តមាន time-in។ បានដកចេញពីការជ្រើស៖ {preview}, និង {more} នាក់ទៀត។',

        accountEmployeeLinkRequired:
          'គណនីចូលប្រើរបស់អ្នកមិនទាន់ភ្ជាប់ជាមួយប្រវត្តិបុគ្គលិកទេ។ សូមពិនិត្យការកំណត់ Account និង Employee។',
        approverNotFound:
          'រកមិនឃើញអ្នកអនុម័ត OT ក្នុងគំនូសតាងអង្គភាព។ សូមកំណត់ខ្សែអ្នកគ្រប់គ្រង និង OT Role = Approver។',
        duplicateEmployeeDate:
          'បុគ្គលិកខ្លះមានសំណើ OT រួចសម្រាប់ថ្ងៃនេះ។',

        timingMode: {
          customFixed: 'Custom Fixed Time',
          fixedTime: 'Fixed Time',
          afterShiftEnd: 'ក្រោយបញ្ចប់វេន',
        },

        employeePicker: {
          title: '3. ជ្រើសបុគ្គលិក',
          searchPlaceholder: 'ស្វែងរក ID, ឈ្មោះ, ខ្សែ, មុខតំណែង ឬវេន...',
          scopePlaceholder: 'វិសាលភាពបុគ្គលិក',

          myEmployees: 'បុគ្គលិករបស់ខ្ញុំ',
          allEmployees: 'បុគ្គលិកទាំងអស់',
          allLines: 'ខ្សែទាំងអស់',

          noLine: 'គ្មានខ្សែ',
          unnamedLine: 'ខ្សែគ្មានឈ្មោះ',
          noShift: 'គ្មានវេន',
          noEmployeeId: 'គ្មាន ID',

          chooseDateFirst: 'ជ្រើសកាលបរិច្ឆេទ OT ជាមុន។',
          checkingBlocked:
            'កំពុងពិនិត្យបុគ្គលិកដែលបានប្រើក្នុង OT រួចសម្រាប់ថ្ងៃនេះ...',
          loadingEmployees: 'កំពុងផ្ទុកបុគ្គលិក...',
          autoSelecting: 'កំពុងជ្រើសបុគ្គលិកដោយស្វ័យប្រវត្តិតាមខ្សែ...',

          emptyTitle: 'រកមិនឃើញបុគ្គលិក',
          emptyText: 'សូមសាកល្បងពាក្យស្វែងរក តម្រងខ្សែ ឬវិសាលភាពបុគ្គលិកផ្សេង។',

          staffCount: 'បុគ្គលិក {count}',
          groupSelectedCount: 'បានជ្រើស {selected}/{total}',
          unavailableCount: 'មិនអាចប្រើបាន {count}',
          manualOnly: 'Manual only',
          manualSelect: 'ជ្រើសដោយដៃ',
          available: 'អាចប្រើបាន',
          selected: 'បានជ្រើស',

          columnStart: 'ចាប់ផ្តើម',
          columnEnd: 'បញ្ចប់',

          resetDefaultTime: 'កំណត់ពេលលំនាំដើមឡើងវិញ',
          scrollMoreLocal: 'Scroll ក្នុងខ្សែនេះដើម្បីបង្ហាញបុគ្គលិកបន្ថែម...',
          loadingMore: 'កំពុងផ្ទុកបន្ថែម...',
          allMatchedLoaded: 'បានផ្ទុកបុគ្គលិកដែលត្រូវគ្នាទាំងអស់។',

          cannotSelectTitle: 'មិនអាចជ្រើសបាន',
          noSelectableInGroup: 'គ្មានបុគ្គលិកដែលអាចជ្រើសបានក្នុងក្រុមនេះ។',
          cannotSelectEmployeeTitle: 'មិនអាចជ្រើសបុគ្គលិកបាន',
          cannotEditEmployeeTitle: 'មិនអាចកែប្រែបុគ្គលិកបាន',

          lineFilterUnavailableTitle: 'តម្រងខ្សែមិនអាចប្រើបាន',
          lineFilterUnavailableDetail: 'មិនអាចផ្ទុកជម្រើសតម្រងខ្សែបានទេ។',

          employeeLoadFailedTitle: 'ផ្ទុកបុគ្គលិកបរាជ័យ',
          employeeLoadFailedDetail: 'មិនអាចផ្ទុកបុគ្គលិកបានទេ។',

          autoSelectFailedTitle: 'ជ្រើសដោយស្វ័យប្រវត្តិបរាជ័យ',
          autoSelectFailedDetail: 'មិនអាចជ្រើសបុគ្គលិករបស់អ្នកដោយស្វ័យប្រវត្តិបានទេ។',

          unknownError: 'បញ្ហាមិនស្គាល់។',
          invalidValue: 'តម្លៃមិនត្រឹមត្រូវ',

          invalidEmployee: 'បុគ្គលិកមិនត្រឹមត្រូវ។',
          alreadyInRequest: 'មានក្នុងសំណើ OT {requestNo} រួចហើយ',
          alreadyUnavailable: 'មិនអាចប្រើបានសម្រាប់ថ្ងៃនេះរួចហើយ។',
          employeeNoShift: 'បុគ្គលិកមិនមានវេន។',
          noLineNotEligible: 'បុគ្គលិកមិនមានខ្សែផលិតកម្ម ដូច្នេះមិនអាចជ្រើសសម្រាប់ OT បានទេ។',
          shiftMismatch: 'វេនបុគ្គលិកមិនត្រូវនឹងវេនដែលបានជ្រើស។',
        },
      },
    },

    policy: {
      tableTitle: 'គោលការណ៍គណនា OT',
      subtitle:
        'ច្បាប់គណនា OT ដែលកំណត់ដោយ Backend ប្រើសម្រាប់ជម្រើស OT តាមវេន និងការផ្ទៀងផ្ទាត់ទូទាត់។',
      searchPlaceholder: 'ស្វែងរកកូដ ឈ្មោះ ឬការពិពណ៌នា',

      newPolicy: 'គោលការណ៍ថ្មី',
      createTitle: 'បង្កើតគោលការណ៍ OT',
      editTitle: 'កែប្រែគោលការណ៍ OT',

      policy: 'គោលការណ៍',
      rounding: 'ការបង្គត់',
      eligibility: 'លក្ខខណ្ឌអនុញ្ញាត',
      behavior: 'ឥរិយាបថ',
      forgetScan: 'ភ្លេច Scan',
      behaviorFlags: 'ជម្រើសឥរិយាបថ',
      flagValue: '{label}: {value}',

      allMethods: 'វិធីទាំងអស់',
      roundMethodLabel: 'វិធីបង្គត់',
      minEligible: 'អប្បបរមាអនុញ្ញាត',
      roundUnit: 'ឯកតាបង្គត់',
      graceAfterShiftEnd: 'អនុគ្រោះក្រោយបញ្ចប់វេន',

      minEligibleShort: 'អប្ប.',
      graceShort: 'អនុគ្រោះ',
      everyUnit: 'រាល់ {unit}',

      codePlaceholder: 'ឧទាហរណ៍៖ POST_SHIFT_STD_30M',
      namePlaceholder: 'ឧទាហរណ៍៖ Post Shift Standard 30-Minute Ceiling',
      descriptionPlaceholder: 'កំណត់ចំណាំសម្រាប់ Admin ប្រសិនបើមាន...',
      activeHelp: 'គោលការណ៍សកម្មអាចប្រើសម្រាប់ Shift OT Options ថ្មី។',

      loading: 'កំពុងផ្ទុកគោលការណ៍ OT',
      noData: 'គ្មានគោលការណ៍ OT ត្រូវនឹងលក្ខខណ្ឌស្វែងរក។',
      loadFailed: 'ផ្ទុកគោលការណ៍ OT មិនបានសម្រេច។',
      saveFailed: 'រក្សាទុកគោលការណ៍ OT មិនបានសម្រេច។',
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
        treatForgetScanInAsPending: 'ខ្វះ clock-in រង់ចាំ',
        treatForgetScanOutAsPending: 'ខ្វះ clock-out រង់ចាំ',
        allowApprovedOtWithoutExactClockOut: 'មិនចាំបាច់ clock-out ត្រឹមត្រូវ',
      },

      flagHelp: {
        allowPreShiftOT: 'អនុញ្ញាត OT មុនចាប់ផ្តើមវេន។',
        allowPostShiftOT: 'អនុញ្ញាត OT ក្រោយបញ្ចប់វេន។',
        capByRequestedMinutes: 'មិនបង់លើស OT ដែលបានស្នើ។',
        treatForgetScanInAsPending: 'ត្រូវការពិនិត្យពេលខ្វះ clock-in។',
        treatForgetScanOutAsPending: 'ត្រូវការពិនិត្យពេលខ្វះ clock-out។',
        allowApprovedOtWithoutExactClockOut:
          'អនុញ្ញាត OT ដែលបានអនុម័តដោយគ្មាន clock-out ត្រឹមត្រូវពេលគោលការណ៍អនុញ្ញាត។',
      },

      short: {
        allowPreShiftOT: 'មុន',
        allowPostShiftOT: 'ក្រោយ',
        capByRequestedMinutes: 'កំណត់',
        treatForgetScanInAsPending: 'FS In',
        treatForgetScanOutAsPending: 'FS Out',
        allowApprovedOtWithoutExactClockOut: 'No Exact Out',
      },

      flagShort: {
        pre: 'មុន {value}',
        post: 'ក្រោយ {value}',
        cap: 'កំណត់ {value}',
        noExactOut: 'No exact out {value}',
        fsIn: 'FS In {value}',
        fsOut: 'FS Out {value}',
      },

      validation: {
        codeRequired: 'ត្រូវការកូដគោលការណ៍។',
        codeTooLong: 'កូដគោលការណ៍មិនត្រូវលើស 50 តួអក្សរ។',
        nameRequired: 'ត្រូវការឈ្មោះគោលការណ៍។',
        nameTooLong: 'ឈ្មោះគោលការណ៍មិនត្រូវលើស 150 តួអក្សរ។',
        descriptionTooLong: 'ការពិពណ៌នាមិនត្រូវលើស 1000 តួអក្សរ។',
        roundMethodRequired: 'ត្រូវការវិធីបង្គត់។',
        roundMethodInvalid: 'វិធីបង្គត់ត្រូវជា Floor, Ceil ឬ Nearest។',
        roundUnitInvalid: 'ឯកតាបង្គត់ត្រូវយ៉ាងតិច 1 នាទី។',
        roundUnitMinutesInvalid: 'ឯកតាបង្គត់ត្រូវយ៉ាងតិច 1 នាទី។',
        minEligibleInvalid: 'នាទីអប្បបរមាអនុញ្ញាតមិនអាចអវិជ្ជមានបានទេ។',
        minEligibleMinutesInvalid:
          'នាទីអប្បបរមាអនុញ្ញាតមិនអាចអវិជ្ជមានបានទេ។',
        graceInvalid: 'នាទីអនុគ្រោះមិនអាចអវិជ្ជមានបានទេ។',
        graceAfterShiftEndMinutesInvalid:
          'នាទីអនុគ្រោះក្រោយបញ្ចប់វេនមិនអាចអវិជ្ជមានបានទេ។',
        updatePayloadRequired: 'សូមធ្វើបច្ចុប្បន្នភាពយ៉ាងហោចណាស់មួយវាល។',
      },

      error: {
        codeExists: 'កូដគោលការណ៍ OT មានរួចហើយ។',
        notFound: 'រកមិនឃើញគោលការណ៍ OT។',
        notFoundOrInactive: 'រកមិនឃើញគោលការណ៍ OT ឬវាមិនសកម្ម។',
        inactive: 'គោលការណ៍ OT មិនសកម្ម។',
      },
    },

    shiftOption: {
      tableTitle: 'ជម្រើស OT តាមវេន',
      subtitle:
        'គ្រប់គ្រងជម្រើស OT តាមវេន ប្រភេទថ្ងៃ របៀបពេលវេលា និងគោលការណ៍គណនា។',
      searchPlaceholder: 'ស្វែងរកវេន ស្លាកជម្រើស គោលការណ៍ ឬរបៀបពេលវេលា',

      newOption: 'ជម្រើសថ្មី',
      createTitle: 'បង្កើតជម្រើស OT តាមវេន',
      editTitle: 'កែប្រែជម្រើស OT តាមវេន',

      allShifts: 'វេនទាំងអស់',
      allPolicies: 'គោលការណ៍ទាំងអស់',
      allTimingModes: 'របៀបពេលវេលាទាំងអស់',
      allDayTypes: 'ប្រភេទថ្ងៃទាំងអស់',

      optionLabel: 'ស្លាកជម្រើស',
      dayType: 'ប្រភេទថ្ងៃ',
      timingMode: 'របៀបពេលវេលា',
      otWindow: 'ចន្លោះពេល OT',
      requested: 'បានស្នើ',
      break: 'សម្រាក',
      paid: 'បានបង់',
      policy: 'គោលការណ៍គណនា',
      sequence: 'លំដាប់',

      selectShift: 'ជ្រើសវេន',
      selectPolicy: 'ជ្រើសគោលការណ៍គណនា',
      labelPlaceholder: 'ឧទាហរណ៍៖ Evening OT 18:00 - 20:00',

      applicableDayTypes: 'ប្រភេទថ្ងៃដែលអាចប្រើបាន',
      selectDayTypes: 'ជ្រើសប្រភេទថ្ងៃ',
      startAfterShiftEnd: 'ចាប់ផ្តើមក្រោយបញ្ចប់វេន',
      startAfterShiftEndHelp:
        'Backend ប្រើម៉ោងបញ្ចប់វេនដែលបានជ្រើស បូក offset នេះ ដើម្បីបង្កើតចន្លោះ OT។',
      requestedMinutes: 'នាទីដែលបានស្នើ',
      fixedStartTime: 'ម៉ោងចាប់ផ្តើមកំណត់',
      fixedEndTime: 'ម៉ោងបញ្ចប់កំណត់',
      activeHelp: 'ជម្រើសមិនសកម្មនឹងមិនមានសម្រាប់សំណើ OT ថ្មីទេ។',

      timing: {
        afterShiftEnd: 'ក្រោយបញ្ចប់វេន',
        fixedTime: 'ពេលវេលាកំណត់',
      },

      timingModeLabel: {
        afterShiftEnd: 'ក្រោយបញ្ចប់វេន',
        fixedTime: 'ពេលវេលាកំណត់',
      },

      afterShiftOffset: 'Offset {offset} ក្រោយបញ្ចប់វេន',
      roundEvery: 'បង្គត់រាល់ {unit}',
      minEligibleValue: 'អប្ប. {value}',

      noData: 'គ្មានជម្រើស OT តាមវេនត្រូវនឹងលក្ខខណ្ឌស្វែងរក។',
      loadFailed: 'ផ្ទុកជម្រើស OT តាមវេនមិនបានសម្រេច។',
      saveFailed: 'រក្សាទុកជម្រើស OT តាមវេនមិនបានសម្រេច។',
      createdSuccess: 'បានបង្កើតជម្រើស OT តាមវេនដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពជម្រើស OT តាមវេនដោយជោគជ័យ។',
      shiftLookupFailed: 'ផ្ទុកជម្រើសវេនមិនបានសម្រេច។',
      policyLookupFailed: 'ផ្ទុកជម្រើសគោលការណ៍មិនបានសម្រេច។',

      validation: {
        required: 'សូមជ្រើសជម្រើស OT។',
        shiftRequired: 'ត្រូវការវេន។',
        labelRequired: 'ត្រូវការស្លាកជម្រើស។',
        labelTooLong: 'ស្លាកជម្រើសមិនត្រូវលើស 100 តួអក្សរ។',
        timingModeRequired: 'ត្រូវការរបៀបពេលវេលា។',
        timingModeInvalid: 'របៀបពេលវេលាមិនត្រឹមត្រូវ។',
        dayTypeInvalid: 'ប្រភេទថ្ងៃមិនត្រឹមត្រូវ។',
        applicableDayTypesRequired:
          'សូមជ្រើសប្រភេទថ្ងៃដែលអាចប្រើបានយ៉ាងហោចណាស់មួយ។',
        applicableDayTypesTooMany:
          'អ្នកអាចជ្រើសប្រភេទថ្ងៃបានអតិបរមា 3 ប៉ុណ្ណោះ។',
        dayTypesRequired: 'សូមជ្រើសប្រភេទថ្ងៃយ៉ាងហោចណាស់មួយ។',
        policyRequired: 'ត្រូវការគោលការណ៍គណនា។',
        requestedMinutesInvalid: 'នាទីដែលបានស្នើត្រូវយ៉ាងតិច 1។',
        sequenceInvalid: 'លំដាប់ត្រូវយ៉ាងតិច 1។',
        startAfterShiftEndInvalid:
          'នាទីចាប់ផ្តើមក្រោយបញ្ចប់វេនមិនអាចអវិជ្ជមានបានទេ។',
        startAfterShiftEndMinutesInvalid:
          'នាទីចាប់ផ្តើមក្រោយបញ្ចប់វេនមិនអាចអវិជ្ជមានបានទេ។',
        fixedStartTimeInvalid: 'ម៉ោងចាប់ផ្តើមកំណត់ត្រូវប្រើទម្រង់ HH:mm។',
        fixedEndTimeInvalid: 'ម៉ោងបញ្ចប់កំណត់ត្រូវប្រើទម្រង់ HH:mm។',
        fixedTimeSame: 'ម៉ោងចាប់ផ្តើម និងបញ្ចប់កំណត់មិនអាចដូចគ្នាបានទេ។',
        fixedTimeRequired:
          'ជម្រើស OT fixed-time ដែលបានជ្រើសត្រូវមានម៉ោងចាប់ផ្តើម និងបញ្ចប់កំណត់។',
        breakMinutesInvalid: 'នាទីសម្រាកត្រូវជាចំនួនគត់មិនអវិជ្ជមាន។',
        breakMinutesTooLarge:
          'នាទីសម្រាកមិនអាចធំជាង ឬស្មើរយៈពេល OT បានទេ។',
        updatePayloadRequired: 'សូមធ្វើបច្ចុប្បន្នភាពយ៉ាងហោចណាស់មួយវាល។',
      },

      error: {
        notFound: 'រកមិនឃើញជម្រើស OT តាមវេន។',
        duplicate: 'មានជម្រើស OT សកម្មស្ទួនសម្រាប់វេននេះ។',
        labelExists: 'ស្លាកជម្រើស OT សកម្មមានរួចហើយសម្រាប់វេននេះ។',
        sequenceExists:
          'លំដាប់ជម្រើស OT សកម្មមានរួចហើយសម្រាប់វេន និងប្រភេទថ្ងៃនេះ។',
        dayTypeMismatch:
          'ជម្រើស OT ដែលបានជ្រើសមិនអនុញ្ញាតសម្រាប់កាលបរិច្ឆេទ OT នេះទេ។',
        shiftMismatch:
          'ជម្រើស OT ដែលបានជ្រើសមិនមែនជារបស់វេនបុគ្គលិកដែលបានកំណត់ទេ។',
      },
    },

    request: {
      validation: {
        otDateRequired: 'ត្រូវការកាលបរិច្ឆេទ OT។',
        employeeRequired: 'សូមជ្រើសបុគ្គលិកយ៉ាងហោចណាស់ 1 នាក់។',
        employeeIdsInvalid: 'បញ្ជីបុគ្គលិកមិនត្រឹមត្រូវ។',
        employeeMaxExceeded: 'អ្នកអាចជ្រើសបុគ្គលិកបានអតិបរមា 200 នាក់ប៉ុណ្ណោះ។',
        employeeOverrideMaxExceeded:
          'អ្នកអាចកំណត់ពេល Custom សម្រាប់បុគ្គលិកបានអតិបរមា 200 នាក់ប៉ុណ្ណោះ។',

        timingSourceInvalid: 'ប្រភពពេលវេលា OT មិនត្រឹមត្រូវ។',
        shiftOtOptionRequired: 'សូមជ្រើសជម្រើស OT។',

        customFixedTimeRequired:
          'ត្រូវការម៉ោងចាប់ផ្តើម និងបញ្ចប់ Custom fixed OT។',
        customStartTimeRequired: 'ត្រូវការម៉ោងចាប់ផ្តើម Custom។',
        customEndTimeRequired: 'ត្រូវការម៉ោងបញ្ចប់ Custom។',
        customTimeSame: 'ម៉ោងចាប់ផ្តើម និងបញ្ចប់ Custom មិនអាចដូចគ្នាបានទេ។',

        breakMinutesInvalid: 'នាទីសម្រាកត្រូវជាចំនួនគត់មិនអវិជ្ជមាន។',
        breakMinutesTooLarge:
          'នាទីសម្រាកមិនអាចធំជាង ឬស្មើរយៈពេល OT បានទេ។',

        reasonTooLong: 'មូលហេតុមិនត្រូវលើស 2000 តួអក្សរ។',
        remarkTooLong: 'កំណត់ចំណាំមិនត្រូវលើស 1000 តួអក្សរ។',

        overrideTimeSame:
          'ម៉ោងចាប់ផ្តើម និងបញ្ចប់ Custom របស់បុគ្គលិកមិនអាចដូចគ្នាបានទេ។',
        overrideEmployeeNotSelected:
          'ពេលវេលា Custom អាចកំណត់បានតែសម្រាប់បុគ្គលិកដែលបានជ្រើសប៉ុណ្ណោះ។',
        overrideEmployeeDuplicate:
          'បុគ្គលិកស្ទួនក្នុងបញ្ជី Custom time override។',

        statusInvalid: 'ស្ថានភាព OT មិនត្រឹមត្រូវ។',
        dayTypeInvalid: 'ប្រភេទថ្ងៃ OT មិនត្រឹមត្រូវ។',
        approvalActionInvalid: 'សកម្មភាពអនុម័តមិនត្រឹមត្រូវ។',
        rejectionReasonRequired: 'សូមបញ្ចូលមូលហេតុបដិសេធ។',
        requesterConfirmationActionInvalid:
          'សកម្មភាពបញ្ជាក់របស់អ្នកស្នើមិនត្រឹមត្រូវ។',
      },

      error: {
        notFound: 'រកមិនឃើញសំណើ OT។',
        requesterEmployeeRequired: 'ត្រូវការប្រវត្តិបុគ្គលិករបស់អ្នកស្នើ។',
        approverNotFound: 'រកមិនឃើញអ្នកអនុម័ត OT ក្នុងគំនូសតាងអង្គភាព។',
        approverInactive: 'អ្នកអនុម័តមិនសកម្ម។',
        employeeDuplicateDate:
          'បុគ្គលិកខ្លះមានសំណើ OT រួចសម្រាប់ថ្ងៃនេះ។',
        todayAttendanceTimeInRequired:
          'មិនអាចបង្កើតសំណើ OT សម្រាប់ថ្ងៃនេះបានទេ ព្រោះបុគ្គលិកខ្លះមិនមាន attendance time-in។',
        editNotAllowed: 'មិនអាចកែប្រែសំណើ OT នេះបានទេ។',
        confirmNotAllowed:
          'ការបញ្ជាក់របស់អ្នកស្នើមិនអាចប្រើបានសម្រាប់សំណើ OT នេះទេ។',
        onlyPendingCanDecide: 'អាចសម្រេចបានតែសំណើ OT ដែលកំពុងរង់ចាំប៉ុណ្ណោះ។',
        currentApprovalStepNotFound: 'រកមិនឃើញជំហានអនុម័តបច្ចុប្បន្ន។',
        currentStepNotApprover:
          'ជំហាន workflow បច្ចុប្បន្នមិនមែនជាជំហានអ្នកអនុម័តទេ។',
        notWaitingForYourApproval:
          'សំណើ OT នេះមិនកំពុងរង់ចាំការអនុម័តពីអ្នកទេ។',
        noEmployeesToApprove: 'សំណើ OT នេះគ្មានបុគ្គលិកសម្រាប់អនុម័ត។',
        noAdjustedEmployeeList:
          'គ្មានបញ្ជីបុគ្គលិកដែលបានកែសម្រាប់បញ្ជាក់។',
        employeeShiftRequired:
          'បុគ្គលិកដែលបានជ្រើសទាំងអស់ត្រូវមានវេនកំណត់។',
        employeeShiftMismatch:
          'បុគ្គលិកដែលបានជ្រើសទាំងអស់ត្រូវស្ថិតក្នុងវេនដូចគ្នា។',
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

    salary_file_required: 'ត្រូវការឯកសារ Excel ប្រាក់ខែ។',
    salary_file_invalid: 'ឯកសារ Excel ប្រាក់ខែទទេ ឬមិនត្រឹមត្រូវ។',

    attendance: {
      no_verification_result:
        'រកមិនឃើញលទ្ធផលផ្ទៀងផ្ទាត់វត្តមានសម្រាប់បុគ្គលិកនេះ។',
    },

    formula: {
      invalid_id: 'លេខសម្គាល់រូបមន្តទូទាត់មិនត្រឹមត្រូវ។',
      not_found: 'រកមិនឃើញរូបមន្តទូទាត់។',
      inactive: 'រូបមន្តទូទាត់មិនសកម្ម។',
      code_required: 'ត្រូវការកូដរូបមន្តទូទាត់។',
      code_already_exists: 'កូដរូបមន្តទូទាត់មានរួចហើយ។',
    },

    exchange_rate: {
      invalid_id: 'លេខសម្គាល់អត្រាប្តូរប្រាក់ទូទាត់មិនត្រឹមត្រូវ។',
      not_found: 'រកមិនឃើញអត្រាប្តូរប្រាក់ទូទាត់។',
      inactive: 'អត្រាប្តូរប្រាក់ទូទាត់មិនសកម្ម។',
      currency_mismatch:
        'រូបិយប័ណ្ណរបស់រូបមន្តទូទាត់មិនត្រូវនឹងរូបិយប័ណ្ណដើមរបស់អត្រាប្តូរប្រាក់ទេ។',
      target_must_be_khr: 'រូបិយប័ណ្ណគោលដៅនៃអត្រាប្តូរប្រាក់ត្រូវតែជា KHR។',
    },

    formulas: {
      tableTitle: 'បញ្ជីរូបមន្តទូទាត់',
      searchPlaceholder: 'ស្វែងរកកូដ ឈ្មោះ រូបិយប័ណ្ណ ឬការពិពណ៌នា',

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

      codePlaceholder: 'ឧទាហរណ៍៖ STD_OT_2026',
      namePlaceholder: 'ឧទាហរណ៍៖ Standard OT Formula 2026',
      descriptionPlaceholder: 'ការពិពណ៌នារូបមន្ត ប្រសិនបើមាន',

      dialogNote:
        'ការកំណត់រូបមន្តត្រូវបានរក្សាទុក។ ឯកសារ Excel ប្រាក់ខែ និងលទ្ធផលទូទាត់ដែលបានបង្កើតមិនត្រូវបានរក្សាទុកទេ។',
      previewTitle: 'មើលរូបមន្តជាមុន',
      hourlyRatePreview:
        'Hourly Rate = ប្រាក់ខែប្រចាំខែ ÷ ថ្ងៃធ្វើការ ÷ ម៉ោងក្នុងមួយថ្ងៃ',
      otAmountPreview:
        'OT Amount = ម៉ោង OT ដែលត្រូវបង់ × Hourly Rate × មេគុណប្រភេទថ្ងៃ',

      noData: 'គ្មានរូបមន្តទូទាត់ត្រូវនឹងលក្ខខណ្ឌស្វែងរក។',
      loadFailed: 'ផ្ទុករូបមន្តទូទាត់មិនបានសម្រេច។',
      saveFailed: 'រក្សាទុករូបមន្តទូទាត់មិនបានសម្រេច។',
      createdSuccess: 'បានបង្កើតរូបមន្តទូទាត់ដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពរូបមន្តទូទាត់ដោយជោគជ័យ។',

      validation: {
        codeRequired: 'ត្រូវការកូដ។',
        codeTooLong: 'កូដវែងពេក។',
        nameRequired: 'ត្រូវការឈ្មោះ។',
        nameTooLong: 'ឈ្មោះវែងពេក។',
        descriptionTooLong: 'ការពិពណ៌នាវែងពេក។',
        monthlyWorkingDaysRequired: 'ត្រូវការចំនួនថ្ងៃធ្វើការប្រចាំខែ។',
        monthlyWorkingDaysInvalid:
          'ចំនួនថ្ងៃធ្វើការប្រចាំខែត្រូវធំជាង 0។',
        hoursPerDayRequired: 'ត្រូវការចំនួនម៉ោងក្នុងមួយថ្ងៃ។',
        hoursPerDayInvalid: 'ម៉ោងក្នុងមួយថ្ងៃត្រូវធំជាង 0។',
        workingDayMultiplierInvalid:
          'មេគុណថ្ងៃធ្វើការមិនអាចអវិជ្ជមានបានទេ។',
        sundayMultiplierInvalid: 'មេគុណថ្ងៃអាទិត្យមិនអាចអវិជ្ជមានបានទេ។',
        holidayMultiplierInvalid:
          'មេគុណថ្ងៃឈប់សម្រាកមិនអាចអវិជ្ជមានបានទេ។',
        roundingInvalid: 'ខ្ទង់បង្គត់ត្រូវនៅចន្លោះ 0 ដល់ 6។',
        updatePayloadRequired: 'ត្រូវការវាលយ៉ាងហោចណាស់មួយ។',
      },

      error: {
        invalidId: 'លេខសម្គាល់រូបមន្តទូទាត់មិនត្រឹមត្រូវ។',
        notFound: 'រកមិនឃើញរូបមន្តទូទាត់។',
        inactive: 'រូបមន្តទូទាត់មិនសកម្ម។',
        codeRequired: 'ត្រូវការកូដរូបមន្តទូទាត់។',
        codeAlreadyExists: 'កូដរូបមន្តទូទាត់មានរួចហើយ។',
      },
    },

    exchangeRates: {
      tableTitle: 'អត្រាប្តូរប្រាក់ទូទាត់',
      newExchangeRate: 'អត្រាថ្មី',
      createTitle: 'បង្កើតអត្រាប្តូរប្រាក់',
      editTitle: 'កែប្រែអត្រាប្តូរប្រាក់',

      searchPlaceholder: 'ស្វែងរកកូដ ឈ្មោះ រូបិយប័ណ្ណ ឬការពិពណ៌នា',

      noData: 'រកមិនឃើញអត្រាប្តូរប្រាក់។',
      loadFailed: 'មិនអាចផ្ទុកអត្រាប្តូរប្រាក់ទូទាត់បានទេ។',
      saveFailed: 'មិនអាចរក្សាទុកអត្រាប្តូរប្រាក់ទូទាត់បានទេ។',
      createdSuccess: 'បានបង្កើតអត្រាប្តូរប្រាក់ទូទាត់ដោយជោគជ័យ។',
      updatedSuccess: 'បានធ្វើបច្ចុប្បន្នភាពអត្រាប្តូរប្រាក់ទូទាត់ដោយជោគជ័យ។',

      rateName: 'ឈ្មោះអត្រា',
      currencyPair: 'គូរូបិយប័ណ្ណ',
      rate: 'អត្រា',
      rounding: 'ការបង្គត់',
      mode: 'របៀប',
      unit: 'ឯកតា',
      fromCurrency: 'ពីរូបិយប័ណ្ណ',
      toCurrency: 'ទៅរូបិយប័ណ្ណ',
      roundingUnit: 'ឯកតាបង្គត់',
      roundingMode: 'របៀបបង្គត់',
      denominations: 'ប្រភេទក្រដាសប្រាក់',

      codePlaceholder: 'ឧទាហរណ៍៖ KHR_4020',
      namePlaceholder: 'ឧទាហរណ៍៖ USD to KHR 4020',
      descriptionPlaceholder: 'កំណត់ចំណាំសម្រាប់អត្រាប្តូរប្រាក់នេះ ប្រសិនបើមាន',

      dialogNote:
        'អត្រាប្តូរប្រាក់ត្រូវបានគ្រប់គ្រងដោយឡែកពីរូបមន្តទូទាត់។ បង្កើតអត្រាណាមួយដែលត្រូវការ បន្ទាប់មកជ្រើសវាពេលដំណើរការទូទាត់។',

      roundingPreviewTitle: 'របៀបបង្គត់',
      roundRulePreview:
        'ROUND by 100 មានន័យថា 101–149 ក្លាយជា 100 ហើយ 150–199 ក្លាយជា 200។',
      cashBreakdownPreview:
        'ប្រភេទក្រដាសប្រាក់ត្រូវបានប្រើដើម្បីគណនាចំនួនក្រដាសប្រាក់ពីធំទៅតូច។',

      roundingModes: {
        round: 'បង្គត់ជិតបំផុត',
        ceil: 'បង្គត់ឡើង',
        floor: 'បង្គត់ចុះ',
        none: 'មិនបង្គត់',
      },

      validation: {
        codeRequired: 'ត្រូវការកូដ។',
        codeTooLong: 'កូដមិនត្រូវលើស 50 តួអក្សរ។',
        nameRequired: 'ត្រូវការឈ្មោះ។',
        nameTooLong: 'ឈ្មោះមិនត្រូវលើស 150 តួអក្សរ។',
        descriptionTooLong: 'ការពិពណ៌នាមិនត្រូវលើស 1000 តួអក្សរ។',
        fromCurrencyRequired: 'ត្រូវការរូបិយប័ណ្ណដើម។',
        toCurrencyRequired: 'ត្រូវការរូបិយប័ណ្ណគោលដៅ។',
        rateRequired: 'ត្រូវការអត្រា។',
        ratePositive: 'អត្រាត្រូវធំជាង 0។',
        roundingUnitPositive: 'ឯកតាបង្គត់ត្រូវធំជាង 0។',
        roundingModeInvalid: 'របៀបបង្គត់មិនត្រឹមត្រូវ។',
        denominationsRequired: 'ត្រូវការប្រភេទក្រដាសប្រាក់យ៉ាងហោចណាស់មួយ។',
        updatePayloadRequired: 'គ្មានទិន្នន័យសម្រាប់ធ្វើបច្ចុប្បន្នភាព។',
      },

      error: {
        invalidId: 'លេខសម្គាល់អត្រាប្តូរប្រាក់ទូទាត់មិនត្រឹមត្រូវ។',
        notFound: 'រកមិនឃើញអត្រាប្តូរប្រាក់ទូទាត់។',
        inactive: 'អត្រាប្តូរប្រាក់ទូទាត់មិនសកម្ម។',
        codeRequired: 'ត្រូវការកូដ។',
        codeExists: 'កូដអត្រាប្តូរប្រាក់មានរួចហើយ។',
      },
    },

    process: {
      field: {
        paymentFormula: 'រូបមន្តទូទាត់',
        exchangeRate: 'អត្រាប្តូរប្រាក់',
        noExchangeRate: 'មិនទាន់ជ្រើសអត្រាប្តូរប្រាក់',
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
        uploadSalary: 'Upload ប្រាក់ខែ',
        changeFile: 'ប្ដូរឯកសារ',
        template: 'គំរូ',
        preview: 'មើលជាមុន',
        generate: 'បង្កើត',
        loadMore: 'ផ្ទុកបន្ថែម',
      },

      card: {
        processingTitle: 'ដំណើរការទូទាត់',
        formulaTitle: 'មើលរូបមន្តជាមុន',
      },

      status: {
        previewReady: 'Preview រួចរាល់',
        notPreviewed: 'មិនទាន់ Preview',
        ready: 'រួចរាល់',
      },

      note: {
        notSaved:
          'ឯកសារប្រាក់ខែ លទ្ធផល Preview និងឯកសារទូទាត់ចុងក្រោយមិនត្រូវបានរក្សាទុកទេ។ បើទាញយកបរាជ័យ សូម Upload ប្រាក់ខែ ហើយបង្កើតម្តងទៀត។',
      },

      calendar: {
        title: 'ពិនិត្យប្រតិទិនខាងក្នុង',
        loading: 'កំពុងផ្ទុកប្រតិទិន',
        holidayCount: 'ថ្ងៃឈប់សម្រាក {count}',
        workingDays: 'ថ្ងៃធ្វើការ',
        sundays: 'ថ្ងៃអាទិត្យ',
        internalHolidays: 'ថ្ងៃឈប់សម្រាកខាងក្នុង',
      },

      preview: {
        title: 'មើលការទូទាត់ជាមុន',
      },

      summary: {
        payableEmployees: 'បុគ្គលិកដែលត្រូវបង់',
        totalOtHours: 'ម៉ោង OT សរុប',
        totalAmount: 'ចំនួនសរុប',
        totalUsd: 'USD សរុប',
        totalKhr: 'KHR សរុប',
        missingSalary: 'ខ្វះប្រាក់ខែ',
        warnings: 'ការព្រមាន',
      },

      table: {
        setup: 'ការកំណត់ទូទាត់',
        detail: 'ព័ត៌មានលម្អិតទូទាត់',
        missingSalary: 'ខ្វះប្រាក់ខែ',
        warnings: 'ការព្រមាន',
      },

      column: {
        type: 'ប្រភេទ',
        row: 'ជួរ',

        requestNo: 'លេខសំណើ',
        otOption: 'ជម្រើស OT',
        otTime: 'ម៉ោង OT',
        paymentDayType: 'ប្រភេទថ្ងៃ',

        employeeId: 'លេខបុគ្គលិក',
        employeeName: 'ឈ្មោះបុគ្គលិក',

        requested: 'បានស្នើ',
        break: 'សម្រាក',
        payable: 'ត្រូវបង់',
        otHours: 'ម៉ោង OT',

        salary: 'ប្រាក់ខែ',
        hourlyRate: 'អត្រាក្នុងមួយម៉ោង',
        multiplier: 'មេគុណ',
        amount: 'ចំនួន',
        amountUsd: 'ចំនួន USD',

        exchangeRate: 'អត្រា',
        rawKhr: 'KHR មិនទាន់បង្គត់',
        roundedKhr: 'KHR បង្គត់រួច',
        roundDiffKhr: 'ខុសគ្នាបន្ទាប់ពីបង្គត់',

        salaryFound: 'រកឃើញប្រាក់ខែ',
        currency: 'រូបិយប័ណ្ណ',
        decision: 'ការសម្រេច',
        reason: 'មូលហេតុ',
      },

      label: {
        cappedByRequestPaid: 'បានកំណត់ដោយនាទីដែលស្នើបង់',
        backendCalculated: 'គណនាដោយ Backend',
      },

      empty: {
        noFormula: 'មិនទាន់ជ្រើសរូបមន្ត',
        selectFormula: 'ជ្រើសរូបមន្តទូទាត់សកម្មមុនពេល Preview។',
        selectFormulaFirst: 'ជ្រើសរូបមន្តជាមុន',
        noPaymentDetail: 'រកមិនឃើញព័ត៌មានលម្អិតទូទាត់ដែលត្រូវបង់។',
        noMissingSalary: 'មិនមានប្រាក់ខែខ្វះ។',
        noWarnings: 'មិនមានការព្រមាន។',
        previewTitle: 'មិនទាន់មាន Preview ទូទាត់',
        previewHint:
          'Upload Excel ប្រាក់ខែ ហើយចុច Preview ដើម្បីមើលលទ្ធផលទូទាត់មុនពេលទាញយក។',
      },

      validation: {
        fromDateRequired: 'ត្រូវការ From date។',
        toDateRequired: 'ត្រូវការ To date។',
        formulaRequired: 'ត្រូវការរូបមន្តទូទាត់។',
        exchangeRateRequired: 'ត្រូវការអត្រាប្តូរប្រាក់។',
        salaryRequired: 'ត្រូវការឯកសារ Excel ប្រាក់ខែ។',
        invalidDateRange: 'From date មិនអាចក្រោយ To date បានទេ។',
        dateYmd: 'កាលបរិច្ឆេទត្រូវតែមានទម្រង់ YYYY-MM-DD។',
        invalidFormulaId: 'លេខសម្គាល់រូបមន្តទូទាត់មិនត្រឹមត្រូវ។',
        invalidExchangeRateId: 'លេខសម្គាល់អត្រាប្តូរប្រាក់ទូទាត់មិនត្រឹមត្រូវ។',
        toDateAfterFrom: 'To date ត្រូវធំជាង ឬស្មើ From date។',
      },

      message: {
        loadFormulasFailed: 'ផ្ទុករូបមន្តទូទាត់មិនបានសម្រេច។',
        loadExchangeRatesFailed: 'ផ្ទុកអត្រាប្តូរប្រាក់ទូទាត់មិនបានសម្រេច។',

        calendarFailedTitle: 'ប្រតិទិនបរាជ័យ',
        calendarFailed: 'ផ្ទុកប្រតិទិនថ្ងៃឈប់សម្រាកខាងក្នុងមិនបានសម្រេច។',

        invalidFileTitle: 'ឯកសារមិនត្រឹមត្រូវ',
        invalidFile: 'សូម Upload តែឯកសារ Excel៖ .xlsx ឬ .xls។',

        downloadedTitle: 'បានទាញយក',
        downloadFailedTitle: 'ទាញយកមិនបានសម្រេច',
        templateDownloaded: 'បានទាញយកគំរូប្រាក់ខែ។',
        templateDownloadFailed: 'ទាញយកគំរូប្រាក់ខែមិនបានសម្រេច។',

        checkFormTitle: 'ពិនិត្យ Form',

        previewReadyTitle: 'Preview រួចរាល់',
        previewReady: 'បានគណនា Preview ទូទាត់ដោយជោគជ័យ។',
        previewFailedTitle: 'Preview បរាជ័យ',
        previewFailed: 'គណនា Preview ទូទាត់មិនបានសម្រេច។',

        previewRequiredTitle: 'ត្រូវការ Preview',
        previewRequired:
          'សូម Preview ការទូទាត់ មុនពេលបង្កើត Excel។',

        generatedTitle: 'បានបង្កើត',
        generated: 'បានបង្កើត Excel ទូទាត់ដោយជោគជ័យ។',
        generateFailedTitle: 'បង្កើតមិនបានសម្រេច',
        generateFailed: 'បង្កើត Excel ទូទាត់មិនបានសម្រេច។',
      },

      salary: {
        fileRequired: 'ត្រូវការឯកសារ Excel ប្រាក់ខែ។',
        fileInvalid: 'ឯកសារ Excel ប្រាក់ខែទទេ ឬមិនត្រឹមត្រូវ។',
        unableToRead: 'មិនអាចអានឯកសារ Excel ប្រាក់ខែបានទេ។',
        noSheet: 'Excel ប្រាក់ខែគ្មាន sheet។',
        missingEmployeeId: 'ខ្វះ Employee ID។',
        invalidSalary: 'ប្រាក់ខែមិនត្រឹមត្រូវ។',
        duplicateEmployeeId: 'Employee ID ស្ទួនក្នុង Excel ប្រាក់ខែ។',
        salaryNotFound: 'រកមិនឃើញប្រាក់ខែក្នុង Excel ប្រាក់ខែដែលបាន Upload។',
      },

      issue: {
        invalidSalaryRow: 'ជួរប្រាក់ខែមិនត្រឹមត្រូវ',
        duplicateSalaryRow: 'ជួរប្រាក់ខែស្ទួន',
        missingSalary: 'ខ្វះប្រាក់ខែ',
        noPayableMinutes: 'គ្មាននាទីត្រូវបង់ពីវត្តមាន/គោលការណ៍',
        attendanceVerificationNotSaved:
          'ការផ្ទៀងផ្ទាត់វត្តមានមិនទាន់បានរក្សាទុក',
        noAttendancePolicyPayable:
          'រកមិនឃើញនាទីត្រូវបង់ពីវត្តមាន/គោលការណ៍។',
        payableWarning:
          'នាទីត្រូវបង់ត្រូវបានគណនា ប៉ុន្តែលទ្ធផលផ្ទៀងផ្ទាត់មិនមែនជា MATCH ពិតប្រាកដ។',
      },
    },
  },
}