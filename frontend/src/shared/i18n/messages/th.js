// frontend/src/shared/i18n/messages/th.js

export default {
  common: {
    appName: 'คำขอ OT',

    loading: 'กำลังโหลด',
    updating: 'กำลังอัปเดต',
    search: 'ค้นหา',
    refresh: 'รีเฟรช',
    clear: 'ล้าง',
    selectAll: 'เลือกทั้งหมด',
    export: 'ส่งออก',
    import: 'นำเข้า',
    download: 'ดาวน์โหลด',
    create: 'สร้าง',
    update: 'อัปเดต',
    delete: 'ลบ',
    save: 'บันทึก',
    cancel: 'ยกเลิก',
    close: 'ปิด',
    confirm: 'ยืนยัน',
    approve: 'อนุมัติ',
    reject: 'ปฏิเสธ',
    view: 'ดู',
    detail: 'รายละเอียด',
    action: 'การดำเนินการ',
    actions: 'การดำเนินการ',
    edit: 'แก้ไข',
    back: 'กลับ',

    no: 'ลำดับ',
    yes: 'ใช่',
    none: 'ไม่มี',
    unknown: 'ไม่ทราบ',
    warning: 'คำเตือน',
    thisData: 'ข้อมูลนี้',

    status: 'สถานะ',
    allStatus: 'สถานะทั้งหมด',
    active: 'ใช้งาน',
    inactive: 'ไม่ใช้งาน',

    fromDate: 'วันที่เริ่มต้น',
    toDate: 'วันที่สิ้นสุด',
    date: 'วันที่',
    name: 'ชื่อ',
    code: 'รหัส',
    description: 'คำอธิบาย',
    createdAt: 'สร้างเมื่อ',
    updatedAt: 'อัปเดตเมื่อ',

    loaded: 'โหลดแล้ว {loaded} จาก {total}',
    noData: 'ไม่พบข้อมูล',
    somethingWentWrong: 'เกิดข้อผิดพลาด',
    loadFailed: 'โหลดไม่สำเร็จ',
    createFailed: 'สร้างไม่สำเร็จ',
    updateFailed: 'อัปเดตไม่สำเร็จ',
    saveFailed: 'บันทึกไม่สำเร็จ',
    downloadFailed: 'ดาวน์โหลดไม่สำเร็จ',
    created: 'สร้างแล้ว',
    updated: 'อัปเดตแล้ว',
    deleted: 'ลบแล้ว',
    deleteFailed: 'ลบไม่สำเร็จ',
    downloaded: 'ดาวน์โหลดแล้ว',
    loadingData: 'กำลังโหลดข้อมูล',
    fetchingRecords: 'กำลังดึงข้อมูลจากเซิร์ฟเวอร์',

    noPermission: 'ไม่มีสิทธิ์',
    openNavigation: 'เปิดเมนูนำทาง',
    toggleDesktopSidebar: 'เปิด/ปิดแถบเมนูเดสก์ท็อป',
    toggleTheme: 'สลับธีม',
    switchToLightMode: 'สลับเป็นโหมดสว่าง',
    switchToDarkMode: 'สลับเป็นโหมดมืด',
    notifications: 'การแจ้งเตือน',
    language: 'ภาษา',

    statusValue: {
      active: 'ใช้งาน',
      inactive: 'ไม่ใช้งาน',
      unknown: 'ไม่ทราบ',
    },

    error: {
      internalServerError: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
      validationError: 'ข้อมูลไม่ถูกต้อง',
      invalidId: 'ID ไม่ถูกต้อง',
      notFound: 'ไม่พบข้อมูล',
      routeNotFound: 'ไม่พบเส้นทาง',
      duplicateRecord: 'ข้อมูลซ้ำ',
      checkRequiredFields: 'โปรดตรวจสอบช่องข้อมูลที่จำเป็น',
      duplicateOrConflict:
        'ข้อมูลนี้มีอยู่แล้วหรือขัดแย้งกับข้อมูลอื่น',
      missingPermissionWithSubject:
        'ไม่สามารถโหลด {subject} ได้ เนื่องจากบัญชีของคุณไม่มีสิทธิ์: {permission}',
      missingPermissionForSubject:
        'ไม่สามารถโหลด {subject} ได้ เนื่องจากบัญชีของคุณไม่มีสิทธิ์ที่จำเป็น',
      saveMissingPermission:
        'คุณไม่สามารถบันทึกข้อมูลนี้ได้ เนื่องจากบัญชีของคุณไม่มีสิทธิ์: {permission}',
      saveNoPermission: 'คุณไม่มีสิทธิ์บันทึกข้อมูลนี้',
    },

    validation: {
      invalidId: 'ID ไม่ถูกต้อง',
      idRequired: 'จำเป็นต้องระบุ ID',
      tooLong: 'ค่ายาวเกินไป',
      dateInvalid: 'วันที่ไม่ถูกต้อง',
      timeRequired: 'จำเป็นต้องระบุเวลา',
      timeInvalid: 'เวลาต้องใช้รูปแบบ HH:mm',
      pageInvalid: 'หน้าไม่ถูกต้อง',
      limitInvalid: 'จำนวนจำกัดไม่ถูกต้อง',
      searchTooLong: 'ข้อความค้นหายาวเกินไป',
      sortFieldInvalid: 'ฟิลด์เรียงลำดับไม่ถูกต้อง',
    },
  },

  validation: {
    field: {
      invalid: 'ค่าไม่ถูกต้อง',
    },
    id: {
      invalid: 'ID ไม่ถูกต้อง',
    },
    page: {
      invalid: 'หน้าไม่ถูกต้อง',
    },
    limit: {
      invalid: 'จำนวนจำกัดไม่ถูกต้อง',
    },
    search: {
      invalid: 'ค่าค้นหาไม่ถูกต้อง',
    },
    isActive: {
      invalid: 'สถานะไม่ถูกต้อง',
    },
    sortField: {
      invalid: 'ฟิลด์เรียงลำดับไม่ถูกต้อง',
    },
    sortOrder: {
      invalid: 'ลำดับการเรียงไม่ถูกต้อง',
    },
  },

  profile: {
    unknownUser: 'ผู้ใช้',
    accountInformation: 'ข้อมูลบัญชี',
    displayName: 'ชื่อแสดง',
    loginId: 'Login ID',
    employee: 'พนักงาน',
    department: 'แผนก',
    position: 'ตำแหน่ง',
  },

  auth: {
    login: 'เข้าสู่ระบบ',
    logout: 'ออกจากระบบ',
    username: 'ชื่อผู้ใช้',
    loginId: 'Login ID',
    password: 'รหัสผ่าน',
    profile: 'โปรไฟล์',

    accessDenied: 'ปฏิเสธการเข้าถึง',
    noPermission: 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้',

    loginSubtitle: 'เข้าสู่ระบบด้วยบัญชีบริษัทเพื่อดำเนินการต่อ',
    loginIdPlaceholder: 'กรอก Login ID',
    passwordPlaceholder: 'กรอกรหัสผ่าน',
    signingIn: 'กำลังเข้าสู่ระบบ...',

    validation: {
      loginIdRequired: 'จำเป็นต้องระบุ Login ID',
      passwordRequired: 'จำเป็นต้องระบุรหัสผ่าน',
    },

    error: {
      loginFailed: 'เข้าสู่ระบบไม่สำเร็จ โปรดลองอีกครั้ง',
      invalidCredentials: 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง',
      unauthorized: 'ไม่ได้รับอนุญาต โปรดเข้าสู่ระบบอีกครั้ง',
      sessionExpired: 'เซสชันหมดอายุ โปรดเข้าสู่ระบบอีกครั้ง',
      invalidToken: 'Token ไม่ถูกต้องหรือหมดอายุ',
      employeeLinkRequired:
        'บัญชีเข้าสู่ระบบของคุณยังไม่ได้เชื่อมกับโปรไฟล์พนักงาน',
    },

    account: {
      tableTitle: 'รายการบัญชี',
      tableSubtitle: 'รายการบัญชีแบบโหลดจากเซิร์ฟเวอร์พร้อม lazy loading',

      newAccount: 'สร้างบัญชีใหม่',
      createTitle: 'สร้างบัญชี',
      editTitle: 'แก้ไขบัญชี',

      searchPlaceholder:
        'ค้นหา Login ID ชื่อแสดง พนักงาน บทบาท หรือสิทธิ์',

      noData: 'ไม่พบบัญชีที่ตรงกับตัวกรอง',
      loadFailed: 'โหลดบัญชีไม่สำเร็จ',

      displayName: 'ชื่อแสดง',
      directPermissions: 'สิทธิ์โดยตรง',
      mustChangePassword: 'ต้องเปลี่ยนรหัสผ่าน',

      selectEmployee: 'เลือกพนักงาน',
      selectRoles: 'เลือกบทบาท',

      directPermissionHelp: 'คั่นรหัสสิทธิ์ด้วยเครื่องหมายจุลภาค',
      directPermissionPlaceholder: 'ACCOUNT_VIEW, ACCOUNT_CREATE',

      loginIdExample: 'ตัวอย่าง: john.smith',
      displayNameExample: 'ตัวอย่าง: John Smith',

      unnamedEmployee: 'พนักงานไม่มีชื่อ',
      unnamedRole: 'บทบาทไม่มีชื่อ',

      employeeOptionsLoadFailed: 'โหลดตัวเลือกพนักงานไม่สำเร็จ',
      roleOptionsLoadFailed: 'โหลดตัวเลือกบทบาทไม่สำเร็จ',

      createdSuccess: 'สร้างบัญชีสำเร็จ',
      updatedSuccess: 'อัปเดตบัญชีสำเร็จ',
      createFailed: 'สร้างบัญชีไม่สำเร็จ',
      updateFailed: 'อัปเดตบัญชีไม่สำเร็จ',

      reset: 'รีเซ็ต',
      resetPassword: 'รีเซ็ตรหัสผ่าน',
      newPassword: 'รหัสผ่านใหม่',
      forcePasswordChange: 'บังคับให้เปลี่ยนรหัสผ่านหลังรีเซ็ต',
      resettingFor: 'กำลังรีเซ็ตรหัสผ่านสำหรับ',
      passwordReset: 'รีเซ็ตรหัสผ่าน',
      passwordResetSuccess: 'รีเซ็ตรหัสผ่านสำเร็จ',
      resetFailed: 'รีเซ็ตรหัสผ่านไม่สำเร็จ',

      validation: {
        loginIdRequired: 'จำเป็นต้องระบุ Login ID',
        loginIdTooLong: 'Login IDต้องไม่เกิน 100 ตัวอักษร',
        displayNameRequired: 'จำเป็นต้องระบุชื่อแสดง',
        passwordMinLength: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
        passwordMaxLength: 'รหัสผ่านต้องไม่เกิน 100 ตัวอักษร',
      },

      error: {
        notFound: 'ไม่พบบัญชี',
        loginIdExists: 'Login IDมีอยู่แล้ว',
      },

      success: {
        passwordReset: 'รีเซ็ตรหัสผ่านสำเร็จ',
      },
    },
  },

  nav: {
    workspace: 'พื้นที่ทำงาน',
    dashboard: 'แดชบอร์ด',

    organization: 'องค์กร',
    permissions: 'สิทธิ์',
    roles: 'บทบาท',
    departments: 'แผนก',
    positions: 'ตำแหน่ง',
    lines: 'ไลน์',
    employees: 'พนักงาน',
    orgChart: 'ผังองค์กร',

    calendar: 'ปฏิทิน',
    holidayMaster: 'ข้อมูลวันหยุด',

    shift: 'กะ',
    shiftMaster: 'ข้อมูลกะ',

    accessControl: 'ควบคุมสิทธิ์',
    accounts: 'บัญชี',

    attendance: 'การเข้างาน',
    attendanceImport: 'นำเข้าการเข้างาน',
    attendanceRecords: 'รายการเข้างาน',
    otVerification: 'ตรวจสอบ OT',

    overtime: 'ล่วงเวลา',
    otRequests: 'คำขอ OT',
    approvalInbox: 'กล่องอนุมัติ',
    acknowledgeInbox: 'กล่องรับทราบ',
    otPolicies: 'นโยบาย OT',
    shiftOtOptions: 'ตัวเลือก OT ตามกะ',

    payment: 'การจ่ายเงิน',
    paymentProcess: 'ประมวลผลการจ่ายเงิน',
    paymentFormulas: 'สูตรการจ่ายเงิน',
    paymentExchangeRates: 'อัตราแลกเปลี่ยน',
  },

  access: {
    error: {
      missingPermission: 'คุณไม่มีสิทธิ์ที่จำเป็น',
      permissionMiddlewareConfigError:
        'Middleware สิทธิ์ไม่มีรหัสสิทธิ์ที่จำเป็น',
    },

    permission: {
      tableTitle: 'รายการสิทธิ์',
      searchPlaceholder: 'ค้นหารหัสสิทธิ์ ชื่อ โมดูล หรือคำอธิบาย',
      module: 'โมดูล',
      allModules: 'โมดูลทั้งหมด',

      loading: 'กำลังโหลดสิทธิ์...',
      noData: 'ไม่พบสิทธิ์ที่ตรงกับตัวกรอง',
      loadFailed: 'โหลดสิทธิ์ไม่สำเร็จ',

      error: {
        notFound: 'ไม่พบสิทธิ์',
      },
    },

    role: {
      tableTitle: 'รายการบทบาท',
      searchPlaceholder: 'ค้นหารหัสบทบาทหรือชื่อแสดง',

      newRole: 'สร้างบทบาทใหม่',
      expandAll: 'ขยายทั้งหมด',
      collapseAll: 'ยุบทั้งหมด',

      createTitle: 'สร้างบทบาท',
      editTitle: 'แก้ไขบทบาท',
      roleCode: 'รหัสบทบาท',
      roleCodeExample: 'ตัวอย่าง: SYSTEM_ADMIN',
      displayName: 'ชื่อแสดง',
      displayNameExample: 'ตัวอย่าง: ผู้ดูแลระบบ',

      permissionsByModule: 'สิทธิ์ตามโมดูล',
      count: 'จำนวน',
      selectedCount: 'เลือกแล้ว {count}',
      moduleSelectedCount: 'เลือกแล้ว {selected} จาก {total}',
      morePermissions: '+อีก {count}',

      noData: 'ไม่พบบทบาทที่ตรงกับตัวกรอง',
      loadFailed: 'โหลดบทบาทไม่สำเร็จ',
      saveFailed: 'บันทึกบทบาทไม่สำเร็จ',
      createdSuccess: 'สร้างบทบาทสำเร็จ',
      updatedSuccess: 'อัปเดตบทบาทสำเร็จ',

      validation: {
        codeRequired: 'จำเป็นต้องระบุรหัสบทบาท',
        codeTooLong: 'รหัสบทบาทยาวเกินไป',
        displayNameRequired: 'จำเป็นต้องระบุชื่อแสดง',
        displayNameTooLong: 'ชื่อแสดงยาวเกินไป',
        updatePayloadRequired: 'โปรดอัปเดตอย่างน้อยหนึ่งช่อง',
      },

      error: {
        notFound: 'ไม่พบบทบาทระบบ',
        codeExists: 'รหัสบทบาทมีอยู่แล้ว',
        invalidPermissionIds: 'Permission ID บางรายการไม่ถูกต้อง',
        permissionInactiveOrNotFound:
          'สิทธิ์บางรายการไม่ถูกต้องหรือไม่ใช้งาน',
      },
    },
  },  org: {
    error: {
      chartCycle: 'ผังองค์กรมีวงจรซ้ำ',
      approverNotFound: 'ผังองค์กรไม่สมบูรณ์: ไม่พบผู้อนุมัติ',
      chartTooDeep: 'ผังองค์กรลึกเกินไปหรือมีวงจรซ้ำ',
    },

    department: {
      tableTitle: 'รายการแผนก',
      searchPlaceholder: 'ค้นหารหัสหรือชื่อ',

      newDepartment: 'สร้างแผนกใหม่',
      importExcel: 'นำเข้า Excel',
      exportExcel: 'ส่งออก Excel',

      createTitle: 'สร้างแผนก',
      editTitle: 'แก้ไขแผนก',
      departmentCode: 'รหัสแผนก',
      departmentName: 'ชื่อแผนก',
      codeExample: 'ตัวอย่าง: HR',
      nameExample: 'ตัวอย่าง: ฝ่ายทรัพยากรบุคคล',

      exported: 'ส่งออกแล้ว',
      exportedSuccess: 'ส่งออก Excel แผนกสำเร็จ',
      exportFailed: 'ส่งออกไม่สำเร็จ',

      imported: 'นำเข้าแล้ว',
      importedSuccess:
        'นำเข้าสำเร็จ สร้าง: {created}, อัปเดต: {updated}',

      importTitle: 'นำเข้า Excel แผนก',
      importGuideTitle: 'คำแนะนำการนำเข้า',
      importGuideStep1: 'ดาวน์โหลดไฟล์ตัวอย่าง',
      importGuideStep2: 'กรอกข้อมูลแผนกตามรูปแบบเดียวกัน',
      importGuideStep3: 'เลือกไฟล์ Excel ที่กรอกเสร็จจากคอมพิวเตอร์',
      importGuideStep4: 'คลิกนำเข้าเพื่ออัปโหลดและประมวลผล',
      importAllOrNothingNote:
        'ทุกแถวต้องถูกต้อง 100% หากมีแถวใดผิดพลาด ระบบจะไม่บันทึกข้อมูลใด ๆ',

      downloadSample: 'ดาวน์โหลดตัวอย่าง',
      downloadSampleFailed: 'ดาวน์โหลดตัวอย่างไม่สำเร็จ',
      sampleDownloaded: 'ดาวน์โหลดไฟล์ตัวอย่างสำเร็จ',

      excelFile: 'ไฟล์ Excel',
      chooseFile: 'เลือกไฟล์',
      noFileSelected: 'ยังไม่ได้เลือกไฟล์',

      importInvalidFileTitle: 'ประเภทไฟล์ไม่ถูกต้อง',
      importInvalidFileMessage:
        'โปรดเลือกเฉพาะไฟล์ Excel: .xlsx, .xls หรือ .csv',
      importFailed: 'นำเข้าไม่สำเร็จ',

      importValidationFailed: 'ตรวจสอบข้อมูลนำเข้าไม่ผ่าน',
      importErrorCount: 'พบข้อผิดพลาด {count} รายการ',
      importErrorListTitle: 'แก้ไขแถว Excel เหล่านี้ก่อนนำเข้า',
      importRow: 'แถว',
      importField: 'ฟิลด์',
      importValue: 'ค่า',
      importReason: 'เหตุผล',
      importUnknownError: 'ข้อผิดพลาดนำเข้าที่ไม่ทราบสาเหตุ',

      noData: 'ไม่พบแผนกที่ตรงกับตัวกรอง',
      loadFailed: 'โหลดแผนกไม่สำเร็จ',
      saveFailed: 'บันทึกแผนกไม่สำเร็จ',
      createdSuccess: 'สร้างแผนกสำเร็จ',
      updatedSuccess: 'อัปเดตแผนกสำเร็จ',

      validation: {
        codeMinLength: 'รหัสแผนกต้องมีอย่างน้อย 2 ตัวอักษร',
        codeTooLong: 'รหัสแผนกต้องไม่เกิน 30 ตัวอักษร',
        nameMinLength: 'ชื่อแผนกต้องมีอย่างน้อย 2 ตัวอักษร',
        nameTooLong: 'ชื่อแผนกต้องไม่เกิน 120 ตัวอักษร',
        updatePayloadRequired: 'โปรดอัปเดตอย่างน้อยหนึ่งช่อง',
      },

      error: {
        notFound: 'ไม่พบแผนก',
        codeExists: 'รหัสแผนกมีอยู่แล้ว',
        invalidId: 'ID แผนกไม่ถูกต้อง',
        excelFileRequired: 'จำเป็นต้องมีไฟล์ Excel',
        excelNoRows: 'ไฟล์ Excel ไม่มีแถวข้อมูล',
      },

      import: {
        success: {
          completed: 'นำเข้าแผนกสำเร็จ',
        },

        error: {
          validationFailed:
            'นำเข้าไม่สำเร็จ โปรดแก้ไขข้อผิดพลาดทุกแถวแล้วลองอีกครั้ง',
          noValidRows: 'ไฟล์ Excel ไม่มีแถวแผนกที่ถูกต้อง',
          duplicateDatabaseCode:
            'นำเข้าไม่สำเร็จ เนื่องจากรหัสแผนกบางรายการขัดแย้งกับข้อมูลที่มีอยู่',

          codeRequired: 'จำเป็นต้องระบุรหัส',
          codeMinLength: 'รหัสต้องมีอย่างน้อย {min} ตัวอักษร',
          codeTooLong: 'รหัสต้องไม่เกิน {max} ตัวอักษร',

          nameRequired: 'จำเป็นต้องระบุชื่อ',
          nameMinLength: 'ชื่อต้องมีอย่างน้อย {min} ตัวอักษร',
          nameTooLong: 'ชื่อต้องไม่เกิน {max} ตัวอักษร',

          invalidStatus: 'สถานะต้องเป็นใช้งานหรือไม่ใช้งาน',
          duplicateCode:
            'พบรหัส "{code}" ซ้ำในไฟล์ Excel พบครั้งแรกที่แถว {firstRowNo}',
        },
      },
    },

    position: {
      tableTitle: 'รายการตำแหน่ง',
      searchPlaceholder:
        'ค้นหารหัส ชื่อ แผนก ตำแหน่งผู้บังคับบัญชา หรือคำอธิบาย',

      department: 'แผนก',
      allDepartments: 'แผนกทั้งหมด',

      hierarchyScope: 'ขอบเขตลำดับชั้น',
      allScopes: 'ขอบเขตทั้งหมด',
      selectHierarchyScope: 'เลือกขอบเขตลำดับชั้น',
      scopeSameLine: 'ไลน์เดียวกัน',
      scopeGlobal: 'ทั้งหมด',
      scopeCrossDepartment: 'ข้ามแผนก',

      newPosition: 'สร้างตำแหน่งใหม่',
      importExcel: 'นำเข้า Excel',
      exportExcel: 'ส่งออก Excel',

      createTitle: 'สร้างตำแหน่ง',
      editTitle: 'แก้ไขตำแหน่ง',
      positionCode: 'รหัสตำแหน่ง',
      positionName: 'ชื่อตำแหน่ง',
      codeExample: 'ตัวอย่าง: SEWER',
      nameExample: 'ตัวอย่าง: พนักงานเย็บ',
      selectDepartment: 'เลือกแผนก',

      reportsToPosition: 'รายงานต่อตำแหน่ง',
      selectReportsToPosition: 'ไม่บังคับ: เลือกตำแหน่งหัวหน้า',
      reportsToHelp:
        'ตัวอย่าง: พนักงานเย็บรายงานต่อหัวหน้าเย็บ สามารถรายงานข้ามแผนกได้',

      managerScope: 'ขอบเขตผู้จัดการ',
      sameLine: 'ไลน์เดียวกัน',
      global: 'ทั้งหมด',
      managerScopeHelp:
        'ไลน์เดียวกัน = ค้นหาผู้จัดการในไลน์การผลิตเดียวกัน ทั้งหมด = ค้นหาผู้จัดการจากตำแหน่งแม่ข้ามแผนก',

      level: 'ระดับ',
      activeHelp:
        'ตำแหน่งที่ไม่ใช้งานจะถูกซ่อนจากตัวเลือกกำหนดพนักงานตามปกติ',
      descriptionPlaceholder: 'คำอธิบายตำแหน่ง (ไม่บังคับ)',

      exported: 'ส่งออกแล้ว',
      exportedSuccess: 'ส่งออก Excel ตำแหน่งสำเร็จ',
      exportFailed: 'ส่งออกไม่สำเร็จ',

      imported: 'นำเข้าแล้ว',
      importedSuccess:
        'นำเข้าสำเร็จ สร้าง: {created}, อัปเดต: {updated}',

      importTitle: 'นำเข้า Excel ตำแหน่ง',
      importGuideTitle: 'คำแนะนำการนำเข้า',
      importGuideStep1: 'ดาวน์โหลดไฟล์ตัวอย่าง',
      importGuideStep2: 'กรอกข้อมูลตำแหน่งโดยใช้รหัสที่อ่านเข้าใจได้เท่านั้น',
      importGuideStep3:
        'รหัสแผนกต้องมีอยู่แล้วในข้อมูลหลักแผนก',
      importGuideStep4:
        'รหัสตำแหน่งผู้บังคับบัญชาต้องมีอยู่แล้วหรืออยู่ในไฟล์นำเข้าเดียวกัน',
      importGuideStep5: 'คลิกนำเข้าเพื่ออัปโหลดและประมวลผล',
      importNote:
        'ผู้ใช้ไม่จำเป็นต้องใช้ Mongo ID ใน Excel ให้ใช้รหัสที่อ่านเข้าใจได้ เช่น รหัสแผนกและรหัสตำแหน่ง',
      importAllOrNothingNote:
        'ทุกแถวต้องถูกต้อง 100% หากมีแถวใดผิดพลาด ระบบจะไม่บันทึกข้อมูลใด ๆ',
      importUploading: 'กำลังอัปโหลดไฟล์... {percent}%',
      importProcessing: 'อัปโหลดไฟล์แล้ว กำลังตรวจสอบแถว Excel และบันทึกข้อมูล...',

      downloadSample: 'ดาวน์โหลดตัวอย่าง',
      downloadSampleFailed: 'ดาวน์โหลดตัวอย่างไม่สำเร็จ',
      sampleDownloaded: 'ดาวน์โหลดไฟล์ตัวอย่างสำเร็จ',

      excelFile: 'ไฟล์ Excel',
      chooseFile: 'เลือกไฟล์',
      noFileSelected: 'ยังไม่ได้เลือกไฟล์',

      importInvalidFileTitle: 'ประเภทไฟล์ไม่ถูกต้อง',
      importInvalidFileMessage:
        'โปรดเลือกเฉพาะไฟล์ Excel: .xlsx, .xls หรือ .csv',
      importFailed: 'นำเข้าไม่สำเร็จ',

      importValidationFailed: 'ตรวจสอบข้อมูลนำเข้าไม่ผ่าน',
      importErrorCount: 'พบข้อผิดพลาด {count} รายการ',
      importErrorListTitle: 'แก้ไขแถว Excel เหล่านี้ก่อนนำเข้า',
      importRow: 'แถว',
      importField: 'ฟิลด์',
      importValue: 'ค่า',
      importReason: 'เหตุผล',
      importUnknownError: 'ข้อผิดพลาดนำเข้าที่ไม่ทราบสาเหตุ',

      noData: 'ไม่พบตำแหน่งที่ตรงกับตัวกรอง',
      loadFailed: 'โหลดตำแหน่งไม่สำเร็จ',
      departmentLoadFailed: 'โหลดแผนกไม่สำเร็จ',
      departmentLookupFailed: 'โหลดตัวเลือกแผนกไม่สำเร็จ',
      parentLoadFailed: 'โหลดตำแหน่งผู้บังคับบัญชาไม่สำเร็จ',
      reportsToLookupFailed: 'โหลดตัวเลือกตำแหน่งผู้บังคับบัญชาไม่สำเร็จ',
      saveFailed: 'บันทึกตำแหน่งไม่สำเร็จ',
      createdSuccess: 'สร้างตำแหน่งสำเร็จ',
      updatedSuccess: 'อัปเดตตำแหน่งสำเร็จ',

      validation: {
        codeMinLength: 'รหัสตำแหน่งต้องมีอย่างน้อย 2 ตัวอักษร',
        codeTooLong: 'รหัสตำแหน่งต้องไม่เกิน 50 ตัวอักษร',
        nameMinLength: 'ชื่อตำแหน่งต้องมีอย่างน้อย 2 ตัวอักษร',
        nameTooLong: 'ชื่อตำแหน่งต้องไม่เกิน 150 ตัวอักษร',
        descriptionTooLong:
          'คำอธิบายต้องไม่เกิน 1000 ตัวอักษร',
        updatePayloadRequired: 'โปรดอัปเดตอย่างน้อยหนึ่งช่อง',
      },

      error: {
        invalidId: 'ID ตำแหน่งไม่ถูกต้อง',
        notFound: 'ไม่พบตำแหน่ง',
        codeExists: 'รหัสตำแหน่งมีอยู่แล้ว',
        departmentNotFound: 'ไม่พบแผนก',
        reportsToNotFound: 'ไม่พบตำแหน่งผู้บังคับบัญชา',
        cannotReportToSelf: 'ตำแหน่งไม่สามารถรายงานต่อตัวเองได้',
        excelFileRequired: 'จำเป็นต้องมีไฟล์ Excel',
        excelNoRows: 'ไฟล์ Excel ไม่มีแถวข้อมูล',
        excelNoValidRows: 'ไฟล์ Excel ไม่มีแถวที่ถูกต้อง',
      },

      import: {
        success: {
          completed: 'นำเข้าตำแหน่งสำเร็จ',
        },

        error: {
          validationFailed:
            'นำเข้าไม่สำเร็จ โปรดแก้ไขข้อผิดพลาดทุกแถวแล้วลองอีกครั้ง',
          duplicateDatabaseCode:
            'นำเข้าไม่สำเร็จ เนื่องจากรหัสตำแหน่งบางรายการขัดแย้งกับข้อมูลที่มีอยู่',

          codeRequired: 'จำเป็นต้องระบุรหัส',
          codeMinLength: 'รหัสต้องมีอย่างน้อย {min} ตัวอักษร',
          codeTooLong: 'รหัสต้องไม่เกิน {max} ตัวอักษร',

          nameRequired: 'จำเป็นต้องระบุชื่อ',
          nameMinLength: 'ชื่อต้องมีอย่างน้อย {min} ตัวอักษร',
          nameTooLong: 'ชื่อต้องไม่เกิน {max} ตัวอักษร',

          departmentCodeTooLong:
            'รหัสแผนกต้องไม่เกิน {max} ตัวอักษร',
          departmentNotFound:
            'ไม่พบรหัสแผนก "{departmentCode}"',

          reportsToCodeTooLong:
            'รหัสตำแหน่งผู้บังคับบัญชาต้องไม่เกิน {max} ตัวอักษร',
          reportsToNotFound:
            'ไม่พบรหัสตำแหน่งผู้บังคับบัญชา "{reportsToPositionCode}"',

          cannotReportToSelf: 'ตำแหน่งไม่สามารถรายงานต่อตัวเองได้',
          invalidScope:
            'ขอบเขตลำดับชั้นต้องเป็น SAME_LINE, GLOBAL หรือ CROSS_DEPARTMENT',
          invalidLevel: 'ระดับต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0',
          descriptionTooLong:
            'คำอธิบายต้องไม่เกิน {max} ตัวอักษร',
          invalidStatus: 'สถานะต้องเป็นใช้งานหรือไม่ใช้งาน',
          duplicateCode:
            'พบรหัส "{code}" ซ้ำในไฟล์ Excel พบครั้งแรกที่แถว {firstRowNo}',
        },
      },
    },    employee: {
      tableTitle: 'รายการพนักงาน',
      searchPlaceholder: 'ค้นหารหัสพนักงาน ชื่อ โทรศัพท์ อีเมล หรือบทบาท OT',

      allDepartments: 'แผนกทั้งหมด',
      allPositions: 'ตำแหน่งทั้งหมด',
      allLines: 'ไลน์ทั้งหมด',
      allShifts: 'กะทั้งหมด',

      newEmployee: 'สร้างพนักงานใหม่',
      importExcel: 'นำเข้า Excel',
      exportExcel: 'ส่งออก Excel',

      createTitle: 'สร้างพนักงาน',
      editTitle: 'แก้ไขพนักงาน',

      employeeCode: 'รหัสพนักงาน',
      displayName: 'ชื่อแสดง',
      employeeCodeExample: 'ตัวอย่าง: TRX001',
      displayNameExample: 'ตัวอย่าง: John Smith',

      selectDepartment: 'เลือกแผนก',
      selectPosition: 'เลือกตำแหน่ง',
      selectLine: 'เลือกไลน์',
      selectShift: 'เลือกกะ',
      selectManager: 'เลือกผู้จัดการ/หัวหน้า',

      manager: 'ผู้จัดการ',
      noManager: 'ไม่มีผู้จัดการ',

      otRole: 'บทบาท OT',
      otWorkflowRole: {
        title: 'บทบาทในขั้นตอน OT',
        none: 'ไม่มี',
        approver: 'ผู้อนุมัติ',
        acknowledge: 'รับทราบ',
      },

      joinDate: 'วันที่เริ่มงาน',
      email: 'อีเมล',
      phone: 'โทรศัพท์',
      phonePlaceholder: 'ตัวอย่าง: 012345678',

      hasAccount: 'มีบัญชี',
      noAccount: 'ไม่มีบัญชี',
      accountAlreadyExists: 'พนักงานนี้มีบัญชีเข้าสู่ระบบอยู่แล้ว',
      createLoginAccount: 'สร้างบัญชีเข้าสู่ระบบ',

      accountLoginId: 'Login ID ของบัญชี',
      accountPassword: 'รหัสผ่านบัญชี',
      mustChangePassword: 'ต้องเปลี่ยนรหัสผ่าน',

      accountDefaultNoAccount: 'ค่าเริ่มต้น: จะไม่สร้างบัญชีเข้าสู่ระบบ',
      accountPreview: 'Login ID: {loginId} · รหัสผ่านเริ่มต้น: {password}',

      accountLoginIdPlaceholder: 'ค่าเริ่มต้น: รหัสพนักงาน',
      defaultPassword: 'รหัสผ่านเริ่มต้น',
      defaultPasswordPlaceholder: 'ค่าเริ่มต้น: รหัสพนักงาน + เบอร์โทรศัพท์',

      accountPhoneRequired:
        'จำเป็นต้องมีเบอร์โทรศัพท์เมื่อสร้างบัญชีเข้าสู่ระบบ เพราะรหัสผ่านเริ่มต้นใช้รหัสพนักงาน + เบอร์โทรศัพท์',

      accountActive: 'บัญชีใช้งาน',

      createdWithAccountSuccess:
        'สร้างพนักงานและบัญชีเข้าสู่ระบบสำเร็จ',
      updatedWithAccountSuccess:
        'อัปเดตพนักงานและสร้างบัญชีเข้าสู่ระบบสำเร็จ',

      exported: 'ส่งออกแล้ว',
      exportedSuccess: 'ส่งออก Excel พนักงานสำเร็จ',
      exportFailed: 'ส่งออกไม่สำเร็จ',

      imported: 'นำเข้าแล้ว',
      importedSuccess:
        'นำเข้าเสร็จสิ้น สร้าง: {created}, อัปเดต: {updated}, สร้างบัญชี: {accountsCreated}',

      importTitle: 'นำเข้า Excel พนักงาน',
      importGuideTitle: 'คำแนะนำการนำเข้า',
      importGuideStep1: 'ดาวน์โหลดไฟล์ตัวอย่าง',
      importGuideStep2: 'กรอกข้อมูลพนักงานโดยใช้รหัสที่อ่านเข้าใจได้เท่านั้น',
      importGuideStep3:
        'วันที่เริ่มงานต้องใช้รูปแบบ DD/MM/YYYY เช่น 30/04/2026',
      importGuideStep4:
        'รหัสแผนก รหัสตำแหน่ง รหัสไลน์ และรหัสกะ ต้องมีอยู่แล้วในข้อมูลหลัก',
      importGuideStep5:
        'ใช้รหัสพนักงานผู้บังคับบัญชาสำหรับผู้จัดการ/หัวหน้า จากนั้นคลิกนำเข้า',
      importAllOrNothingNote:
        'ทุกแถวต้องถูกต้อง 100% หากมีแถวใดผิดพลาด ระบบจะไม่บันทึกข้อมูลใด ๆ',

      downloadSample: 'ดาวน์โหลดตัวอย่าง',
      downloadSampleFailed: 'ดาวน์โหลดตัวอย่างไม่สำเร็จ',
      sampleDownloaded: 'ดาวน์โหลดไฟล์ตัวอย่างสำเร็จ',

      excelFile: 'ไฟล์ Excel',
      chooseFile: 'เลือกไฟล์',
      noFileSelected: 'ยังไม่ได้เลือกไฟล์',

      importInvalidFileTitle: 'ประเภทไฟล์ไม่ถูกต้อง',
      importInvalidFileMessage:
        'โปรดเลือกเฉพาะไฟล์ Excel: .xlsx, .xls หรือ .csv',
      importFailed: 'นำเข้าไม่สำเร็จ',

      importValidationFailed: 'ตรวจสอบข้อมูลนำเข้าไม่ผ่าน',
      importErrorCount: 'พบข้อผิดพลาด {count} รายการ',
      importErrorListTitle: 'แก้ไขแถว Excel เหล่านี้ก่อนนำเข้า',
      importRow: 'แถว',
      importField: 'ฟิลด์',
      importValue: 'ค่า',
      importReason: 'เหตุผล',
      importUnknownError: 'ข้อผิดพลาดนำเข้าที่ไม่ทราบสาเหตุ',
      importUploading: 'กำลังอัปโหลดไฟล์... {percent}%',

      invalidExcelData: 'ข้อมูล Excel ไม่ถูกต้อง',
      importApiNotFound: 'ไม่พบ Import API',
      duplicateData: 'ข้อมูลซ้ำ',
      serverError: 'ข้อผิดพลาดเซิร์ฟเวอร์',

      employeeCodeRequiredHelp:
        'จำเป็นต้องระบุรหัสพนักงาน เพราะระบบใช้เป็นรหัสพนักงานที่ผู้ใช้อ่านเข้าใจได้',
      joinDateFormatHelp:
        'โปรดใช้รูปแบบ DD/MM/YYYY เช่น 30/04/2026',
      checkDepartmentMaster: 'โปรดตรวจสอบข้อมูลหลักแผนก',
      checkPositionMaster: 'โปรดตรวจสอบข้อมูลหลักตำแหน่ง',
      positionDepartmentMismatchHelp:
        'รหัสตำแหน่งต้องอยู่ภายใต้รหัสแผนกที่เลือก',
      checkLineMaster: 'โปรดตรวจสอบข้อมูลหลักไลน์',
      checkShiftMaster: 'โปรดตรวจสอบข้อมูลหลักกะ',
      checkManagerEmployeeCode:
        'โปรดนำเข้าผู้จัดการก่อน หรือใช้รหัสพนักงานของผู้จัดการที่มีอยู่แล้ว',
      uniqueEmailHelp: 'อีเมลต้องไม่ซ้ำ หรือปล่อยว่างได้',

      selectLines: 'เลือกไลน์',
      lineHelp:
        'เลือกได้หนึ่งไลน์หรือหลายไลน์ ไลน์แรกที่เลือกจะเป็นไลน์หลักสำหรับรายงานเดิมและความเข้ากันได้',
      multiLineHelp:
        'เลือกได้หนึ่งไลน์หรือหลายไลน์ ไลน์แรกที่เลือกจะเป็นไลน์หลักสำหรับรายงานเดิมและความเข้ากันได้',

      noData: 'ไม่พบพนักงานที่ตรงกับตัวกรอง',
      loadFailed: 'โหลดพนักงานไม่สำเร็จ',
      departmentLoadFailed: 'โหลดแผนกไม่สำเร็จ',
      positionLoadFailed: 'โหลดตำแหน่งไม่สำเร็จ',
      lineLoadFailed: 'โหลดไลน์ไม่สำเร็จ',
      shiftLoadFailed: 'โหลดกะไม่สำเร็จ',
      managerLoadFailed: 'โหลดผู้จัดการไม่สำเร็จ',
      saveFailed: 'บันทึกพนักงานไม่สำเร็จ',
      createdSuccess: 'สร้างพนักงานสำเร็จ',
      updatedSuccess: 'อัปเดตพนักงานสำเร็จ',

      field: {
        departmentId: {
          required: 'จำเป็นต้องระบุแผนก',
          invalid: 'แผนกไม่ถูกต้อง',
        },
        positionId: {
          required: 'จำเป็นต้องระบุตำแหน่ง',
          invalid: 'ตำแหน่งไม่ถูกต้อง',
        },
        lineId: {
          required: 'จำเป็นต้องระบุไลน์',
          invalid: 'ไลน์ไม่ถูกต้อง',
        },
        lineIds: {
          required: 'จำเป็นต้องระบุไลน์',
          invalid: 'ไลน์ที่เลือกบางรายการไม่ถูกต้อง',
        },
        shiftId: {
          required: 'จำเป็นต้องระบุกะ',
          invalid: 'กะไม่ถูกต้อง',
        },
        reportsToEmployeeId: {
          required: 'จำเป็นต้องระบุผู้จัดการ',
          invalid: 'ผู้จัดการไม่ถูกต้อง',
        },
      },

      validation: {
        employeeCodeRequired: 'จำเป็นต้องระบุรหัสพนักงาน',
        employeeCodeTooLong:
          'รหัสพนักงานต้องไม่เกิน 50 ตัวอักษร',
        displayNameRequired: 'จำเป็นต้องระบุชื่อแสดง',
        displayNameTooLong:
          'ชื่อแสดงต้องไม่เกิน 150 ตัวอักษร',
        departmentCodeRequired: 'จำเป็นต้องระบุรหัสแผนก',
        departmentCodeTooLong:
          'รหัสแผนกต้องไม่เกิน 50 ตัวอักษร',
        positionCodeRequired: 'จำเป็นต้องระบุรหัสตำแหน่ง',
        positionCodeTooLong:
          'รหัสตำแหน่งต้องไม่เกิน 50 ตัวอักษร',
        shiftCodeRequired: 'จำเป็นต้องระบุรหัสกะ',
        shiftCodeTooLong: 'รหัสกะต้องไม่เกิน 50 ตัวอักษร',
        phoneTooLong: 'โทรศัพท์ต้องไม่เกิน 30 ตัวอักษร',
        phoneRequiredForAccount:
          'จำเป็นต้องมีเบอร์โทรศัพท์เมื่อสร้างบัญชีเข้าสู่ระบบให้พนักงาน',
        joinDateInvalid: 'วันที่เริ่มงานไม่ถูกต้อง',
        otWorkflowRoleInvalid:
          'บทบาทขั้นตอน OT ต้องเป็น NONE, APPROVER หรือ ACKNOWLEDGE',
        isActiveInvalid: 'สถานะไม่ถูกต้อง',
        updatePayloadRequired: 'โปรดอัปเดตอย่างน้อยหนึ่งช่อง',
      },

      error: {
        notFound: 'ไม่พบพนักงาน',
        inactive: 'พนักงานไม่ใช้งาน',
        notInScope: 'พนักงานอยู่นอกขอบเขตของคุณ',
        outsideManagedScope:
          'พนักงานที่เลือกบางคนอยู่นอกขอบเขตที่คุณดูแล',
        employeeCodeExists: 'รหัสพนักงานมีอยู่แล้ว',
        emailExists: 'อีเมลมีอยู่แล้ว',
        accountExists: 'พนักงานนี้มีบัญชีอยู่แล้ว',
        reportToSelf: 'พนักงานไม่สามารถรายงานต่อตัวเองได้',
        reportsToEmployeeNotFound: 'ไม่พบพนักงานผู้บังคับบัญชา',
        excelFileRequired: 'จำเป็นต้องมีไฟล์ Excel',
        excelWorksheetRequired: 'ไฟล์ Excel ไม่มีชีต',
        excelNoRows: 'ไฟล์ Excel ไม่มีแถวข้อมูล',
        excelNoValidRows: 'ไฟล์ Excel ไม่มีแถวที่ถูกต้อง',
      },

      import: {
        success: {
          completed: 'นำเข้าพนักงานสำเร็จ',
        },

        error: {
          validationFailed:
            'นำเข้าไม่สำเร็จ โปรดแก้ไขข้อผิดพลาดทุกแถวแล้วลองอีกครั้ง',
          duplicateDatabaseValue:
            'นำเข้าไม่สำเร็จ เนื่องจากค่าบางรายการขัดแย้งกับข้อมูลพนักงานที่มีอยู่',

          employeeCodeRequired: 'จำเป็นต้องระบุรหัสพนักงาน',
          employeeCodeTooLong:
            'รหัสพนักงานต้องไม่เกิน 50 ตัวอักษร',
          duplicateEmployeeCode:
            'พบรหัสพนักงาน "{employeeCode}" ซ้ำในไฟล์ Excel พบครั้งแรกที่แถว {firstRowNo}',

          displayNameRequired: 'จำเป็นต้องระบุชื่อแสดง',
          displayNameTooLong:
            'ชื่อแสดงต้องไม่เกิน 150 ตัวอักษร',

          departmentCodeRequired: 'จำเป็นต้องระบุรหัสแผนก',
          departmentCodeTooLong:
            'รหัสแผนกต้องไม่เกิน 50 ตัวอักษร',
          departmentNotFound:
            'ไม่พบรหัสแผนก "{departmentCode}"',

          positionCodeRequired: 'จำเป็นต้องระบุรหัสตำแหน่ง',
          positionCodeTooLong:
            'รหัสตำแหน่งต้องไม่เกิน 50 ตัวอักษร',
          positionNotFound: 'ไม่พบรหัสตำแหน่ง "{positionCode}"',
          positionDepartmentMismatch:
            'รหัสตำแหน่ง "{positionCode}" ไม่อยู่ภายใต้รหัสแผนก "{departmentCode}"',

          lineCodeTooLong: 'รหัสไลน์ต้องไม่เกิน 50 ตัวอักษร',
          lineNotFound: 'ไม่พบรหัสไลน์: {lineCodes}',
          lineInactive: 'รหัสไลน์ที่ไม่ใช้งาน: {lineCodes}',
          lineDepartmentMismatch:
            'รหัสไลน์เหล่านี้ไม่รองรับรหัสแผนก "{departmentCode}": {lineCodes}',
          linePositionNotAllowed:
            'รหัสไลน์เหล่านี้ไม่อนุญาตรหัสตำแหน่ง "{positionCode}": {lineCodes}',

          shiftCodeRequired: 'จำเป็นต้องระบุรหัสกะ',
          shiftCodeTooLong: 'รหัสกะต้องไม่เกิน 50 ตัวอักษร',
          shiftNotFound:
            'ไม่พบรหัสกะ "{shiftCode}" หรือกะไม่ใช้งาน',

          managerCodeTooLong:
            'รหัสพนักงานผู้บังคับบัญชาต้องไม่เกิน 50 ตัวอักษร',
          managerNotFound:
            'ไม่พบรหัสพนักงานผู้บังคับบัญชา "{reportsToEmployeeCode}" ในข้อมูลหลักพนักงานหรือไฟล์นำเข้านี้',
          reportToSelf: 'พนักงานไม่สามารถรายงานต่อตัวเองได้',

          invalidOTWorkflowRole:
            'บทบาทขั้นตอน OT ต้องเป็น NONE, APPROVER หรือ ACKNOWLEDGE',
          phoneTooLong: 'โทรศัพท์ต้องไม่เกิน 30 ตัวอักษร',
          emailTooLong: 'อีเมลต้องไม่เกิน 150 ตัวอักษร',
          emailInvalid: 'รูปแบบอีเมลไม่ถูกต้อง',
          duplicateEmail:
            'พบอีเมล "{email}" ซ้ำในไฟล์ Excel พบครั้งแรกที่แถว {firstRowNo}',
          emailExists:
            'อีเมล "{email}" ถูกใช้กับรหัสพนักงาน "{ownerEmployeeCode}" แล้ว',

          invalidJoinDate:
            'วันที่เริ่มงานต้องใช้รูปแบบ DD/MM/YYYY หรือ YYYY-MM-DD',
          invalidStatus: 'สถานะต้องเป็นใช้งานหรือไม่ใช้งาน',
          invalidCreateAccount: 'สร้างบัญชีต้องเป็น Yes หรือ No หากเว้นว่างจะถือว่า No',

          phoneRequiredForAccount:
            'จำเป็นต้องมีเบอร์โทรศัพท์ เพราะ Create Account = Yes รหัสผ่านเริ่มต้น = รหัสพนักงาน + เบอร์โทรศัพท์',
          defaultPasswordInvalid:
            'รหัสผ่านเริ่มต้นต้องมี 6 ถึง 100 ตัวอักษร และสร้างจากรหัสพนักงาน + เบอร์โทรศัพท์',
          accountLoginIdExists: 'บัญชี Login ID "{loginId}" มีอยู่แล้ว',
        },
      },

      importProgress: {
        waitingUpload: 'รออัปโหลดไฟล์...',
        readFile: 'กำลังอ่านไฟล์ Excel...',
        parseRows: 'กำลังอ่านแถวในชีต...',
        validateBasic: 'กำลังตรวจช่องจำเป็นและแถวซ้ำ...',
        matchDepartment: 'กำลังจับคู่รหัสแผนก...',
        matchPosition: 'กำลังจับคู่รหัสตำแหน่ง...',
        matchLine: 'กำลังจับคู่รหัสไลน์การผลิต...',
        matchShift: 'กำลังจับคู่รหัสกะ...',
        matchEmployee: 'กำลังตรวจพนักงานเดิมและรหัสผู้จัดการ...',
        matchAccount: 'กำลังตรวจบัญชีเข้าสู่ระบบพนักงาน...',
        validateRelation:
          'กำลังตรวจสอบกฎของแผนก ตำแหน่ง ไลน์ กะ ผู้จัดการ และบัญชี...',
        startImport: 'ข้อมูลหลักทั้งหมดตรงกัน เริ่มนำเข้าพนักงาน...',
        importEmployee: 'กำลังนำเข้าพนักงาน...',
        resolveManager: 'กำลังตรวจสอบผู้จัดการ...',
        createAccount: 'กำลังสร้างบัญชีเข้าสู่ระบบพนักงาน...',
        syncManager: 'กำลังสรุปผู้จัดการไลน์...',
        completed: 'นำเข้าพนักงานเสร็จสมบูรณ์',
        failed:
          'นำเข้าพนักงานไม่สำเร็จ โปรดแก้ไขไฟล์ Excel แล้วลองอีกครั้ง',

        guideSubtitle:
          'อัปโหลดไฟล์ Excel พนักงานและติดตามแต่ละขั้นตอนแบบเรียลไทม์',
        runningTitle: 'ความคืบหน้าการนำเข้าพนักงาน',
        percentDone: 'เสร็จแล้ว {percent}%',
        rowProgress: 'ประมวลผลแล้ว {processed} จาก {total} แถว',
        fileUpload: 'อัปโหลดไฟล์: {percent}%',

        statusWaiting: 'รอ',
        statusRunning: 'กำลังทำงาน',
        statusSuccess: 'สำเร็จ',
        statusFailed: 'ล้มเหลว',

        phase: {
          UPLOAD: 'อัปโหลดไฟล์',
          READ_FILE: 'อ่านไฟล์',
          PARSE_ROWS: 'อ่านแถว',
          VALIDATE_BASIC: 'ตรวจข้อมูลพื้นฐาน',
          MATCH_DEPARTMENT: 'จับคู่แผนก',
          MATCH_POSITION: 'จับคู่ตำแหน่ง',
          MATCH_LINE: 'จับคู่ไลน์',
          MATCH_SHIFT: 'จับคู่กะ',
          MATCH_EMPLOYEE: 'ตรวจพนักงาน',
          MATCH_ACCOUNT: 'ตรวจบัญชี',
          VALIDATE_RELATION: 'ตรวจความสัมพันธ์',
          IMPORT_EMPLOYEE: 'นำเข้าพนักงาน',
          RESOLVE_MANAGER: 'ตรวจสอบผู้จัดการ',
          CREATE_ACCOUNT: 'สร้างบัญชี',
          SYNC_MANAGER: 'ซิงค์ผู้จัดการ',
          COMPLETE: 'เสร็จสิ้น',
        },
      },
    },    line: {
      tableTitle: 'รายการไลน์การผลิต',
      searchPlaceholder: 'ค้นหารหัส ชื่อ หรือคำอธิบาย',

      department: 'แผนก',
      departments: 'แผนก',
      allDepartments: 'แผนกทั้งหมด',

      lineCode: 'รหัสไลน์',
      lineName: 'ชื่อไลน์',
      allowedPositions: 'ตำแหน่งที่อนุญาต',
      allPositionsInDepartment: 'ตำแหน่งทั้งหมดในแผนก',
      allPositionsInDepartments: 'ตำแหน่งทั้งหมดในแผนกที่เลือก',

      newLine: 'สร้างไลน์ใหม่',
      importExcel: 'นำเข้า Excel',
      exportExcel: 'ส่งออก Excel',

      createTitle: 'สร้างไลน์การผลิต',
      editTitle: 'แก้ไขไลน์การผลิต',

      selectDepartment: 'เลือกแผนก',
      selectDepartments: 'เลือกแผนก',
      selectAllowedPositions: 'ไม่บังคับ: เลือกตำแหน่งที่อนุญาต',

      codeExample: 'ตัวอย่าง: LINE-01',
      nameExample: 'ตัวอย่าง: ไลน์เย็บ 01',
      descriptionPlaceholder: 'คำอธิบายไลน์การผลิต (ไม่บังคับ)',

      allowedPositionsMultiDepartmentHelp:
        'ปล่อยว่างเพื่ออนุญาตทุกตำแหน่งในแผนกที่เลือก เลือกตำแหน่งเฉพาะเมื่อไลน์นี้ต้องจำกัดเฉพาะบางตำแหน่ง',

      exported: 'ส่งออกแล้ว',
      exportedSuccess: 'ส่งออกไลน์การผลิตสำเร็จ',
      exportFailed: 'ส่งออกไลน์การผลิตไม่สำเร็จ',

      imported: 'นำเข้าแล้ว',
      importedSuccess:
        'นำเข้าสำเร็จ สร้าง: {created}, อัปเดต: {updated}',

      importTitle: 'นำเข้าไลน์การผลิต',
      importGuideTitle: 'คำแนะนำการนำเข้า',
      importGuideStep1: 'ดาวน์โหลดไฟล์ตัวอย่าง',
      importGuideStep2:
        'กรอกข้อมูลไลน์การผลิตโดยใช้รหัสที่อ่านเข้าใจได้เท่านั้น',
      importGuideStep3:
        'รหัสแผนกต้องมีอยู่แล้วในข้อมูลหลักแผนก',
      importGuideStep4:
        'ใช้รหัสตำแหน่งเฉพาะเมื่อไลน์อนุญาตเฉพาะบางตำแหน่ง',
      importAllOrNothingNote:
        'ทุกแถวต้องถูกต้อง 100% หากมีแถวใดผิดพลาด ระบบจะไม่บันทึกข้อมูลใด ๆ',
      importUploading: 'กำลังอัปโหลดไฟล์... {percent}%',
      importProcessing:
        'อัปโหลดไฟล์แล้ว กำลังตรวจสอบแถว Excel และบันทึกข้อมูล...',

      downloadSample: 'ดาวน์โหลดตัวอย่าง',
      downloadSampleFailed: 'ดาวน์โหลดตัวอย่างไม่สำเร็จ',
      sampleDownloaded: 'ดาวน์โหลดไฟล์ตัวอย่างสำเร็จ',

      excelFile: 'ไฟล์ Excel',
      chooseFile: 'เลือกไฟล์',
      noFileSelected: 'ยังไม่ได้เลือกไฟล์',

      importInvalidFileTitle: 'ประเภทไฟล์ไม่ถูกต้อง',
      importInvalidFileMessage:
        'โปรดเลือกเฉพาะไฟล์ Excel: .xlsx, .xls หรือ .csv',
      importFailed: 'นำเข้าไม่สำเร็จ',

      importValidationFailed: 'ตรวจสอบข้อมูลนำเข้าไม่ผ่าน',
      importErrorCount: 'พบข้อผิดพลาด {count} รายการ',
      importErrorListTitle: 'แก้ไขแถว Excel เหล่านี้ก่อนนำเข้า',
      importRow: 'แถว',
      importField: 'ฟิลด์',
      importValue: 'ค่า',
      importReason: 'เหตุผล',
      importUnknownError: 'ข้อผิดพลาดนำเข้าที่ไม่ทราบสาเหตุ',

      noData: 'ไม่พบไลน์การผลิตที่ตรงกับตัวกรอง',
      loadFailed: 'โหลดไลน์การผลิตไม่สำเร็จ',
      departmentLoadFailed: 'โหลดแผนกไม่สำเร็จ',
      positionLoadFailed: 'โหลดตำแหน่งไม่สำเร็จ',
      saveFailed: 'บันทึกไลน์การผลิตไม่สำเร็จ',
      createdSuccess: 'สร้างไลน์การผลิตสำเร็จ',
      updatedSuccess: 'อัปเดตไลน์การผลิตสำเร็จ',

      field: {
        departmentId: {
          required: 'จำเป็นต้องระบุแผนก',
          invalid: 'แผนกไม่ถูกต้อง',
        },
        departmentIds: {
          required: 'จำเป็นต้องเลือกอย่างน้อยหนึ่งแผนก',
          invalid: 'แผนกที่เลือกบางรายการไม่ถูกต้อง',
        },
        positionIds: {
          required: 'จำเป็นต้องระบุตำแหน่ง',
          invalid: 'ตำแหน่งที่เลือกบางรายการไม่ถูกต้อง',
        },
      },

      validation: {
        codeRequired: 'จำเป็นต้องระบุรหัสไลน์',
        codeTooLong: 'รหัสไลน์ต้องไม่เกิน 50 ตัวอักษร',
        nameRequired: 'จำเป็นต้องระบุชื่อไลน์',
        nameTooLong: 'ชื่อไลน์ต้องไม่เกิน 120 ตัวอักษร',
        departmentRequired: 'จำเป็นต้องเลือกอย่างน้อยหนึ่งแผนก',
        descriptionTooLong: 'คำอธิบายต้องไม่เกิน 500 ตัวอักษร',
        updatePayloadRequired: 'โปรดอัปเดตอย่างน้อยหนึ่งช่อง',
      },

      error: {
        notFound: 'ไม่พบไลน์การผลิต',
        codeExists: 'รหัสไลน์มีอยู่แล้ว',
        inactive: 'ไลน์ไม่ใช้งาน',
        departmentMismatch:
          'ไลน์ที่เลือกไม่รองรับแผนกของพนักงานนี้',
        positionNotAllowed:
          'ไลน์ที่เลือกไม่อนุญาตตำแหน่งของพนักงานนี้',
        positionDepartmentMismatch:
          'ตำแหน่งที่เลือกไม่ได้อยู่ในแผนกของไลน์ที่เลือก',
        excelFileRequired: 'จำเป็นต้องมีไฟล์ Excel',
        excelNoRows: 'ไฟล์ Excel ไม่มีแถวข้อมูล',
        excelNoValidRows: 'ไฟล์ Excel ไม่มีแถวที่ถูกต้อง',
      },

      import: {
        success: {
          completed: 'นำเข้าไลน์การผลิตสำเร็จ',
        },

        error: {
          validationFailed:
            'นำเข้าไม่สำเร็จ โปรดแก้ไขข้อผิดพลาดทุกแถวแล้วลองอีกครั้ง',
          duplicateDatabaseCode:
            'นำเข้าไม่สำเร็จ เนื่องจากรหัสไลน์บางรายการขัดแย้งกับข้อมูลที่มีอยู่',

          codeRequired: 'จำเป็นต้องระบุรหัส',
          codeTooLong: 'รหัสต้องไม่เกิน {max} ตัวอักษร',
          duplicateCode:
            'พบรหัสไลน์ "{code}" ซ้ำในไฟล์ Excel พบครั้งแรกที่แถว {firstRowNo}',

          nameRequired: 'จำเป็นต้องระบุชื่อ',
          nameTooLong: 'ชื่อต้องไม่เกิน {max} ตัวอักษร',

          departmentRequired: 'จำเป็นต้องระบุรหัสแผนก',
          departmentCodeTooLong:
            'รหัสแผนกต้องไม่เกิน {max} ตัวอักษร: {departmentCodes}',
          duplicateDepartmentCodeInRow:
            'พบรหัสแผนกซ้ำในแถวเดียวกัน: {departmentCodes}',
          departmentNotFound: 'ไม่พบรหัสแผนก: {departmentCodes}',

          positionCodeTooLong:
            'รหัสตำแหน่งต้องไม่เกิน {max} ตัวอักษร: {positionCodes}',
          duplicatePositionCodeInRow:
            'พบรหัสตำแหน่งซ้ำในแถวเดียวกัน: {positionCodes}',
          positionNotFound:
            'ไม่พบรหัสตำแหน่ง: {positionCodes} รหัสตำแหน่งต้องใช้รหัสจากข้อมูลหลักตำแหน่ง ไม่ใช่รหัสแผนก',
          positionDepartmentMismatch:
            'รหัสตำแหน่งเหล่านี้ไม่อยู่ในรหัสแผนกที่เลือก "{departmentCodes}": {positionCodes}',

          descriptionTooLong:
            'คำอธิบายต้องไม่เกิน {max} ตัวอักษร',
          invalidStatus: 'สถานะต้องเป็นใช้งานหรือไม่ใช้งาน',
        },
      },
    },

    orgChart: {
      searchPlaceholder: 'ค้นหารหัสพนักงานหรือชื่อ',
      rootPerson: 'บุคคลหลัก',
      selectRootPerson: 'เลือกบุคคลหลัก',
      includeInactive: 'รวมรายการไม่ใช้งาน',

      treeTitle: 'ผังองค์กร',
      zoomLabel: 'ซูม: {zoom}',
      zoomIn: 'ซูมเข้า',
      zoomOut: 'ซูมออก',
      resetZoom: 'รีเซ็ต',

      noEmployeeCode: 'ไม่มี ID',
      noPosition: 'ไม่มีตำแหน่ง',
      noDepartment: 'ไม่มีแผนก',

      noTreeData: 'ไม่พบข้อมูลผังองค์กร',
      loadFailed: 'โหลดผังองค์กรไม่สำเร็จ',

      expandNode: 'ขยายโหนด',
      collapseNode: 'ยุบโหนด',
    },
  },

  employee: {
    error: {
      notFound: 'ไม่พบพนักงาน',
      inactive: 'พนักงานไม่ใช้งาน',
    },
  },

  calendar: {
    holidayPicker: {
      selectDate: 'เลือกวันที่',
      loadingHolidays: 'กำลังโหลดวันหยุด...',
      activeHolidayCount: 'วันหยุดที่ใช้งาน {count} วัน',
      sunday: 'วันอาทิตย์',
      workingDay: 'วันทำงาน',
      holiday: 'วันหยุด',
      today: 'วันนี้',
      clear: 'ล้าง',

      week: {
        sun: 'อา.',
        mon: 'จ.',
        tue: 'อ.',
        wed: 'พ.',
        thu: 'พฤ.',
        fri: 'ศ.',
        sat: 'ส.',
      },
    },

    holiday: {
      tableTitle: 'ปฏิทินวันหยุด',
      previewTitle: 'ตัวอย่างปฏิทิน',
      previewCount: 'วันหยุด',
      activeHolidays: 'วันหยุดที่ใช้งาน',
      selectedDate: 'วันที่เลือก',

      searchPlaceholder: 'ค้นหารหัส ชื่อ หรือคำอธิบาย',
      noData: 'ไม่พบวันหยุด',
      loadFailed: 'โหลดวันหยุดไม่สำเร็จ',

      importExcel: 'นำเข้า Excel',
      exportExcel: 'ส่งออก Excel',
      newHoliday: 'สร้างวันหยุดใหม่',
      createTitle: 'สร้างวันหยุด',
      editTitle: 'แก้ไขวันหยุด',
      createOnSelectedDate: 'สร้าง',
      editHoliday: 'แก้ไข',

      selectHolidayDate: 'เลือกวันที่วันหยุด',
      holidayCode: 'รหัสวันหยุด',
      codeExample: 'ตัวอย่าง: KHNY',
      holidayName: 'ชื่อวันหยุด',
      nameExample: 'ตัวอย่าง: ปีใหม่เขมร',
      descriptionPlaceholder: 'หมายเหตุหรือคำอธิบาย (ไม่บังคับ)',
      selectedDayType: 'ประเภทวันที่เลือก',

      paidHoliday: 'วันหยุดได้รับค่าจ้าง',
      paidHolidayHelp: 'ใช้รายการนี้เมื่อวันหยุดเป็นวันหยุดได้รับค่าจ้าง',
      activeHelp:
        'วันหยุดที่ไม่ใช้งานจะไม่ถูกใช้ในการจัดประเภทวัน',
      paid: 'ได้รับค่าจ้าง',
      unpaid: 'ไม่ได้รับค่าจ้าง',
      noCode: 'ไม่มีรหัส',

      createdSuccess: 'สร้างวันหยุดสำเร็จ',
      updatedSuccess: 'อัปเดตวันหยุดสำเร็จ',
      saveFailed: 'บันทึกวันหยุดไม่สำเร็จ',

      exported: 'ส่งออกแล้ว',
      exportedSuccess: 'ส่งออก Excel วันหยุดสำเร็จ',
      exportFailed: 'ส่งออกวันหยุดไม่สำเร็จ',

      imported: 'นำเข้าแล้ว',
      importedSuccess:
        'นำเข้าสำเร็จ สร้าง: {created}, อัปเดต: {updated}',

      importTitle: 'นำเข้าวันหยุด',
      importInvalidFileTitle: 'ประเภทไฟล์ไม่ถูกต้อง',
      importInvalidFileMessage:
        'โปรดเลือกเฉพาะไฟล์ Excel: .xlsx, .xls หรือ .csv',
      importFailed: 'นำเข้าวันหยุดไม่สำเร็จ',

      importGuideTitle: 'คำแนะนำการนำเข้า',
      importGuideStep1: 'ดาวน์โหลดไฟล์ตัวอย่าง',
      importGuideStep2:
        'กรอกวันที่วันหยุด รหัส ชื่อ วันหยุดได้รับค่าจ้าง และสถานะใช้งาน',
      importGuideStep3: 'ใช้รูปแบบ DD/MM/YYYY สำหรับวันที่',
      importGuideStep4: 'อัปโหลดไฟล์ที่กรอกเสร็จแล้ว',
      importNote:
        'วันหยุดที่มีวันที่เดียวกันจะถูกอัปเดต ผู้ใช้ไม่จำเป็นต้องใช้ Mongo ID ใน Excel',

      downloadSample: 'ดาวน์โหลดตัวอย่าง',
      sampleDownloaded: 'ดาวน์โหลดไฟล์ตัวอย่างสำเร็จ',
      downloadSampleFailed: 'ดาวน์โหลดไฟล์ตัวอย่างไม่สำเร็จ',

      excelFile: 'ไฟล์ Excel',
      chooseFile: 'เลือกไฟล์',
      noFileSelected: 'ยังไม่ได้เลือกไฟล์',

      validation: {
        dateInvalid: 'วันที่วันหยุดไม่ถูกต้อง',
        codeTooLong: 'รหัสวันหยุดต้องไม่เกิน 50 ตัวอักษร',
        nameRequired: 'จำเป็นต้องระบุชื่อวันหยุด',
        nameTooLong: 'ชื่อวันหยุดต้องไม่เกิน 150 ตัวอักษร',
        descriptionTooLong:
          'คำอธิบายต้องไม่เกิน 1000 ตัวอักษร',
        updatePayloadRequired: 'โปรดอัปเดตอย่างน้อยหนึ่งช่อง',
      },

      error: {
        invalidDate: 'วันที่วันหยุดไม่ถูกต้อง',
        dateExists: 'มีวันหยุดสำหรับวันที่นี้แล้ว',
        notFound: 'ไม่พบวันหยุด',
        excelFileRequired: 'จำเป็นต้องมีไฟล์ Excel',
        excelNoRows: 'ไฟล์ Excel ไม่มีแถวข้อมูล',
      },

      import: {
        success: {
          completed: 'นำเข้าวันหยุดสำเร็จ',
        },

        error: {
          dateRequired: 'จำเป็นต้องระบุวันที่ ใช้รูปแบบ DD/MM/YYYY',
          nameRequired: 'จำเป็นต้องระบุชื่อวันหยุด',
          invalidPaidHoliday:
            'วันหยุดได้รับค่าจ้างต้องเป็น Yes หรือ No หากเว้นว่างจะถือว่า Yes',
          invalidStatus:
            'สถานะต้องเป็นใช้งานหรือไม่ใช้งาน หากเว้นว่างจะถือว่าใช้งาน',
          duplicateDate:
            'พบวันที่วันหยุด "{date}" ซ้ำในไฟล์นำเข้าที่แถว {rowNo}',
        },
      },
    },
  },  shift: {
    tableTitle: 'รายการกะ',

    type: {
      day: 'กลางวัน',
      night: 'กลางคืน',
    },

    filter: {
      searchPlaceholder: 'ค้นหารหัสหรือชื่อ',
      type: 'ประเภท',
      allTypes: 'ประเภททั้งหมด',
    },

    action: {
      newShift: 'สร้างกะใหม่',
      createShift: 'สร้างกะ',
      importExcel: 'นำเข้า Excel',
      exportExcel: 'ส่งออก Excel',
    },

    column: {
      code: 'รหัส',
      name: 'ชื่อ',
      type: 'ประเภท',
      start: 'เริ่ม',
      breakStart: 'เริ่มพัก',
      breakEnd: 'สิ้นสุดพัก',
      end: 'สิ้นสุด',
      crossMidnight: 'ข้ามเที่ยงคืน',
      working: 'ทำงาน',
    },

    table: {
      empty: 'ไม่พบกะที่ตรงกับตัวกรอง',
    },

    dialog: {
      createTitle: 'สร้างกะ',
      editTitle: 'แก้ไขกะ',
    },

    form: {
      code: 'รหัสกะ',
      name: 'ชื่อกะ',
      type: 'ประเภทกะ',
      startTime: 'เวลาเริ่ม',
      breakStartTime: 'เวลาเริ่มพัก',
      breakEndTime: 'เวลาสิ้นสุดพัก',
      endTime: 'เวลาสิ้นสุด',
      activeStatus: 'สถานะใช้งาน',

      codePlaceholder: 'ตัวอย่าง: DAY-0700',
      namePlaceholder: 'ตัวอย่าง: กะกลางวัน 07:00 - 16:00',
      typePlaceholder: 'เลือกประเภทกะ',

      timeHint:
        'ใช้รูปแบบ HH:mm เช่น 07:00, 12:00, 13:00, 16:00 กะ DAY ต้องไม่ข้ามเที่ยงคืน และกะ NIGHT ต้องข้ามเที่ยงคืน',
    },

    duration: {
      hours: '{hours} ชม.',
      minutes: '{minutes} นาที',
      hoursMinutes: '{hours} ชม. {minutes} นาที',
    },

    permission: {
      noView: 'คุณไม่มีสิทธิ์ดูข้อมูลกะ',
    },

    toast: {
      loadFailedDetail: 'โหลดกะไม่สำเร็จ',
      createdDetail: 'สร้างกะสำเร็จ',
      updatedDetail: 'อัปเดตกะสำเร็จ',
      saveFailedDetail: 'บันทึกกะไม่สำเร็จ',

      exportedTitle: 'ส่งออกแล้ว',
      exportedDetail: 'ส่งออก Excel กะสำเร็จ',
      exportFailedTitle: 'ส่งออกไม่สำเร็จ',
      exportFailedDetail: 'ส่งออกกะไม่สำเร็จ',
    },

    import: {
      title: 'นำเข้ากะ',
      guideTitle: 'คำแนะนำการนำเข้า',
      guideStep1: 'ดาวน์โหลดไฟล์ตัวอย่าง',
      guideStep2: 'กรอกข้อมูลกะตามรูปแบบเดียวกัน',
      guideStep3: 'ใช้ DAY หรือ NIGHT สำหรับประเภทกะ',
      guideStep4:
        'ใช้รูปแบบ HH:mm สำหรับเวลาเริ่ม เวลาเริ่มพัก เวลาสิ้นสุดพัก และเวลาสิ้นสุด',
      guideStep5: 'เลือกไฟล์ Excel ที่กรอกเสร็จแล้ว แล้วคลิกนำเข้า',

      downloadSample: 'ดาวน์โหลดตัวอย่าง',
      sampleDownloaded: 'ดาวน์โหลดไฟล์ตัวอย่างสำเร็จ',

      fileLabel: 'ไฟล์ Excel',
      chooseFile: 'เลือกไฟล์',
      noFileSelected: 'ยังไม่ได้เลือกไฟล์',

      invalidExcelData: 'ข้อมูล Excel ไม่ถูกต้อง',
      importApiNotFound: 'ไม่พบ Import API',
      duplicateData: 'ข้อมูลซ้ำ',
      serverError: 'ข้อผิดพลาดเซิร์ฟเวอร์',

      helpCodeRequired: 'โปรดกรอกรหัสกะ',
      helpType: 'ประเภทกะต้องเป็น DAY หรือ NIGHT',
      helpStartTime: 'เวลาเริ่มต้องใช้รูปแบบ HH:mm เช่น 07:00',
      helpBreakStartTime:
        'เวลาเริ่มพักต้องใช้รูปแบบ HH:mm เช่น 12:00',
      helpBreakEndTime:
        'เวลาสิ้นสุดพักต้องใช้รูปแบบ HH:mm เช่น 13:00',
      helpEndTime: 'เวลาสิ้นสุดต้องใช้รูปแบบ HH:mm เช่น 16:00',
      helpCrossMidnight:
        'กะ DAY ต้องไม่ข้ามเที่ยงคืน และกะ NIGHT ต้องข้ามเที่ยงคืน',
      helpBreakInside: 'เวลาพักต้องอยู่ภายในเวลาทำงานของกะ',
      helpDuplicateCode:
        'รหัสกะต้องไม่ซ้ำ โปรดเปลี่ยนรหัสที่ซ้ำ',

      toast: {
        invalidFileTitle: 'ประเภทไฟล์ไม่ถูกต้อง',
        invalidFileDetail:
          'โปรดเลือกเฉพาะไฟล์ Excel: .xlsx, .xls หรือ .csv',

        importFailedTitle: 'นำเข้าไม่สำเร็จ',
        importFailedDetail: 'นำเข้ากะไม่สำเร็จ',

        importedTitle: 'นำเข้าแล้ว',
        importedDetail:
          'นำเข้าเสร็จสิ้น รวม: {total}, สร้าง: {created}, อัปเดต: {updated}',
      },

      success: {
        completed: 'นำเข้ากะสำเร็จ',
      },

      error: {
        invalidStatus: 'สถานะต้องเป็นใช้งานหรือไม่ใช้งาน',
        rowInvalid: 'ข้อมูลกะไม่ถูกต้อง',
        duplicateShiftId: 'พบ Shift ID ซ้ำในไฟล์นำเข้า',
        duplicateCode: 'พบรหัสกะซ้ำในไฟล์นำเข้า',
        shiftIdNotFound: 'ไม่พบ Shift ID',
      },
    },

    validation: {
      shiftIdInvalid: 'Shift ID ไม่ถูกต้อง',
      codeRequired: 'จำเป็นต้องระบุรหัสกะ',
      codeTooLong: 'รหัสกะต้องไม่เกิน 30 ตัวอักษร',
      nameRequired: 'จำเป็นต้องระบุชื่อกะ',
      nameTooLong: 'ชื่อกะต้องไม่เกิน 120 ตัวอักษร',
      typeInvalid: 'ประเภทกะต้องเป็น DAY หรือ NIGHT',
      startTimeInvalid: 'เวลาเริ่มต้องใช้รูปแบบ HH:mm',
      breakStartTimeInvalid: 'เวลาเริ่มพักต้องใช้รูปแบบ HH:mm',
      breakEndTimeInvalid: 'เวลาสิ้นสุดพักต้องใช้รูปแบบ HH:mm',
      endTimeInvalid: 'เวลาสิ้นสุดต้องใช้รูปแบบ HH:mm',
      endTimeRequired: 'จำเป็นต้องระบุเวลาสิ้นสุดกะ',
      isActiveInvalid: 'สถานะไม่ถูกต้อง',
      updatePayloadRequired: 'โปรดอัปเดตอย่างน้อยหนึ่งช่อง',
    },

    error: {
      notFound: 'ไม่พบกะ',
      inactive: 'กะไม่ใช้งาน',
      codeExists: 'รหัสกะมีอยู่แล้ว',
      startEndSame: 'เวลาเริ่มกะและเวลาสิ้นสุดกะต้องไม่เหมือนกัน',
      breakStartEndSame:
        'เวลาเริ่มพักและเวลาสิ้นสุดพักต้องไม่เหมือนกัน',
      dayCannotCrossMidnight: 'กะ DAY ต้องไม่ข้ามเที่ยงคืน',
      nightMustCrossMidnight: 'กะ NIGHT ต้องข้ามเที่ยงคืน',
      breakEndBeforeStart:
        'เวลาสิ้นสุดพักต้องมากกว่าเวลาเริ่มพัก',
      breakOutsideShift: 'เวลาพักต้องอยู่ภายในเวลาทำงานของกะ',
      excelFileRequired: 'จำเป็นต้องมีไฟล์ Excel',
      excelNoRows: 'ไฟล์ Excel ไม่มีแถวข้อมูล',
    },
  },

  attendance: {
    title: 'การเข้างาน',
    importTitle: 'นำเข้าการเข้างาน',
    recordsTitle: 'รายการเข้างาน',
    verificationTitle: 'ตรวจสอบการเข้างาน OT',

    importDialog: {
      title: 'นำเข้าการเข้างาน',
      guideTitle: 'คำแนะนำการนำเข้า',
      guideStep1: 'เลือกวันที่เข้างานจากปฏิทินที่รู้วันหยุด',
      guideStep2: 'ดาวน์โหลดไฟล์ตัวอย่าง',
      guideStep3: 'กรอก Employee ID, Clock In และ Clock Out',
      guideStep4: 'เลือกไฟล์ Excel ที่กรอกเสร็จแล้ว แล้วคลิกนำเข้า',
      note:
        'จำเป็นต้องระบุวันที่เข้างาน Backend จะจัดประเภทวันจากปฏิทินวันหยุด',

      downloadSample: 'ดาวน์โหลดตัวอย่าง',
      sampleDownloaded: 'ดาวน์โหลดไฟล์ตัวอย่างสำเร็จ',
      downloadFailed: 'ดาวน์โหลดไม่สำเร็จ',

      importCompleted: 'นำเข้าเสร็จแล้ว',
      importCompletedSuccess: 'นำเข้าการเข้างานสำเร็จ',
      importCompletedPartial:
        'นำเข้าการเข้างานสำเร็จบางส่วน โดยมีบางแถวถูกข้ามหรือไม่ถูกต้อง',
      importFailed: 'นำเข้าไม่สำเร็จ',

      validation: 'การตรวจสอบ',
      invalidFile: 'ไฟล์ไม่ถูกต้อง',
      invalidExcelData: 'ข้อมูล Excel ไม่ถูกต้อง',
      importApiNotFound: 'ไม่พบ Import API',
      duplicateData: 'ข้อมูลซ้ำ',
      serverError: 'ข้อผิดพลาดเซิร์ฟเวอร์',

      chooseExcelFile: 'โปรดเลือกไฟล์ Excel',
      invalidExcelFile:
        'โปรดอัปโหลดเฉพาะไฟล์ Excel: .xlsx, .xls หรือ .csv',
      fileTooLarge: 'ขนาดไฟล์ต้องไม่เกิน 10 MB',
      selectAttendanceDate: 'โปรดเลือกวันที่เข้างาน',
      failedDownloadSample: 'ดาวน์โหลดไฟล์ตัวอย่างไม่สำเร็จ',
      failedImportFile: 'นำเข้าไฟล์การเข้างานไม่สำเร็จ',

      checkEmployeeMaster: 'โปรดตรวจสอบข้อมูลหลักพนักงาน',
      checkShiftMaster: 'โปรดตรวจสอบข้อมูลหลักกะ',
      dateFormatHelp: 'โปรดตรวจสอบรูปแบบวันที่ในไฟล์ Excel',
      timeFormatHelp: 'โปรดใช้รูปแบบ HH:mm สำหรับค่าเวลา',

      excelFile: 'ไฟล์ Excel',
      chooseFile: 'เลือกไฟล์',
      noFileSelected: 'ยังไม่ได้เลือกไฟล์',
    },

    import: {
      importAttendance: 'นำเข้าการเข้างาน',
      latestImportResult: 'ผลการนำเข้าล่าสุด',
      latestImportDescription:
        'ไฟล์ที่อัปโหลดล่าสุดถูกประมวลผลโดยระบบนำเข้าของ Backend แล้ว',
      failedRowPreview: 'ตัวอย่างแถวที่ล้มเหลว',
      importHistory: 'ประวัติการนำเข้า',
      importDetail: 'รายละเอียดการนำเข้าการเข้างาน',
      loadingImportDetail: 'กำลังโหลดรายละเอียดการนำเข้า...',
      noImportDetail: 'ไม่พบรายละเอียด',
      noImportRecords: 'ไม่มีรายการนำเข้าในรายละเอียดนี้',
      noImports: 'ไม่พบการนำเข้าการเข้างานที่ตรงกับตัวกรอง',
      detailLoadFailed: 'โหลดรายละเอียดการนำเข้าการเข้างานไม่สำเร็จ',
    },

    records: {
      attendanceList: 'รายการเข้างาน',
      noRecords: 'ไม่พบรายการเข้างานที่ตรงกับตัวกรอง',
      loadFailed: 'โหลดรายการเข้างานไม่สำเร็จ',
    },

    field: {
      attendanceDate: 'วันที่เข้างาน',
      selectAttendanceDate: 'เลือกวันที่เข้างาน',

      importNo: 'เลขที่นำเข้า',
      fileName: 'ชื่อไฟล์',
      period: 'ช่วงเวลา',
      periodFrom: 'ช่วงเริ่มต้น',
      periodTo: 'ช่วงสิ้นสุด',
      row: 'แถว',
      rows: 'แถว',

      totalRows: 'แถวทั้งหมด',
      successRows: 'สำเร็จ',
      failedRows: 'ล้มเหลว',
      duplicateRows: 'ซ้ำ',
      overriddenRows: 'เขียนทับแล้ว',
      importedAt: 'นำเข้าเมื่อ',

      employee: 'พนักงาน',
      employeeNo: 'เลขพนักงาน',
      importedEmployee: 'ข้อมูลนำเข้า',
      department: 'แผนก',
      position: 'ตำแหน่ง',
      line: 'ไลน์',
      shift: 'กะ',

      scanIn: 'สแกนเข้า',
      scanOut: 'สแกนออก',
      clockIn: 'เวลาเข้า',
      clockOut: 'เวลาออก',

      status: 'สถานะ',
      importedStatus: 'สถานะนำเข้า',
      derivedStatus: 'สถานะที่คำนวณ',
      shiftStatus: 'สถานะกะ',
      shiftMatch: 'ตรงกับกะ',
      dayType: 'ประเภทวัน',

      worked: 'ทำงาน',
      late: 'สาย',
      earlyOut: 'ออกก่อน',
      issues: 'ปัญหา',

      searchImportPlaceholder: 'ค้นหาเลขที่นำเข้า ชื่อไฟล์ หรือหมายเหตุ',
      searchRecordsPlaceholder: 'ค้นหาพนักงาน ชื่อนำเข้า หรือเหตุผล',
    },

    option: {
      allDerivedStatus: 'สถานะที่คำนวณทั้งหมด',
      allImportedStatus: 'สถานะนำเข้าทั้งหมด',
      allShiftStatus: 'สถานะกะทั้งหมด',
      allDayTypes: 'ประเภทวันทั้งหมด',
    },

    statusLabel: {
      processing: 'กำลังประมวลผล',
      success: 'สำเร็จ',
      partialSuccess: 'สำเร็จบางส่วน',
      failed: 'ล้มเหลว',

      present: 'มาทำงาน',
      late: 'สาย',
      absent: 'ขาดงาน',
      forgetScanIn: 'ลืมสแกนเข้า',
      forgetScanOut: 'ลืมสแกนออก',
      shiftMismatch: 'ผิดกะ',
      leave: 'ลา',
      off: 'หยุด',
      unknown: 'ไม่ทราบ',

      valid: 'ถูกต้อง',
      imported: 'นำเข้าแล้ว',
      error: 'ข้อผิดพลาด',
      invalid: 'ไม่ถูกต้อง',
      warning: 'คำเตือน',
      duplicate: 'ซ้ำ',
      pending: 'รอดำเนินการ',
      cancelled: 'ยกเลิกแล้ว',
      draft: 'ฉบับร่าง',

      matched: 'ตรงกัน',
      mismatch: 'ไม่ตรงกัน',

      workingDay: 'วันทำงาน',
      sunday: 'วันอาทิตย์',
      holiday: 'วันหยุด',
      missing: 'ขาดหาย',
    },

    message: {
      loadFailed: 'โหลดไม่สำเร็จ',
      detailLoadFailed: 'โหลดรายละเอียดไม่สำเร็จ',
      missingImportId: 'ไม่มี Import ID',
      missingImportIdDetail:
        'ไม่สามารถเปิดรายละเอียดการนำเข้านี้ได้ เพราะไม่มี ID',
      noDataFound: 'ไม่พบข้อมูล',
      updating: 'กำลังอัปเดต',
      failedRowsWarning:
        'บางแถวล้มเหลวหรือถูกข้าม โปรดตรวจสอบรายการแถวที่ล้มเหลวด้านล่าง',
      partialImportWarning:
        'นำเข้าการเข้างานสำเร็จบางส่วน โดยมีบางแถวถูกข้าม ซ้ำ หรือไม่ถูกต้อง',
    },

    result: {
      employee_not_matched: 'พนักงานไม่ตรงกับข้อมูลหลักพนักงาน',
      leave: 'สถานะนำเข้าเป็นลา และไม่มีเวลาสแกน',
      off: 'สถานะนำเข้าเป็นหยุด และไม่มีเวลาสแกน',
      absent: 'ไม่มีเวลาเข้าและไม่มีเวลาออก',
      forget_scan_in: 'มีเวลาออก แต่ไม่มีเวลาเข้า',
      forget_scan_out: 'มีเวลาเข้า แต่ไม่มีเวลาออก',
      shift_mismatch: 'เวลาสแกนไม่ตรงกับกะที่กำหนด',
      late: 'เวลาเข้าเกินเวลาเริ่มกะที่กำหนด',
      present: 'เวลาเข้า/ออกตรงกับกะที่กำหนด',
      unknown: 'ไม่สามารถคำนวณผลการเข้างานได้',
      invalid_clock_format: 'รูปแบบเวลาเข้า/ออกไม่ถูกต้อง',
      invalid_shift_time: 'เวลากะที่กำหนดขาดหายหรือไม่ถูกต้อง',
    },    verification: {
      otDate: 'วันที่ OT',
      selectOtDate: 'เลือกวันที่ OT',
      searchOtRequest: 'ค้นหาคำขอ OT',
      selectOtRequest: 'เลือกคำขอ OT',
      requestStatus: 'สถานะคำขอ',
      results: 'ผลลัพธ์',

      allResults: 'ผลลัพธ์ทั้งหมด',
      matched: 'ตรงกัน',
      acceptedByPolicy: 'ยอมรับตามนโยบาย',
      needsCheck: 'ต้องตรวจสอบ',
      forgetScanIn: 'ลืมสแกนเข้า',
      forgetScanOut: 'ลืมสแกนออก',
      otStaffAbsent: 'พนักงาน OT ขาดงาน',
      wrongShift: 'ผิดกะ',
      notInOtStaff: 'ไม่อยู่ในรายชื่อ OT',
      notEligible: 'ไม่มีสิทธิ์',

      requestStaff: 'พนักงานที่ขอ',
      forgetIn: 'ลืมเข้า',
      forgetOut: 'ลืมออก',
      absent: 'ขาดงาน',
      notInOt: 'ไม่อยู่ใน OT',

      nonFinalWarning:
        'คำขอ OT นี้มีสถานะ {status} คุณสามารถตรวจสอบเพื่อเช็คข้อมูลได้ แต่การจ่าย OT สุดท้ายควรอ้างอิงคำขอที่อนุมัติสมบูรณ์แล้ว',

      requestNo: 'เลขที่คำขอ',
      requester: 'ผู้ขอ',
      shift: 'กะ',
      expectedOt: 'OT ที่คาดไว้',
      requested: 'ที่ขอ',
      policy: 'นโยบาย',

      verificationResult: 'ผลการตรวจสอบ',
      loadingVerification: 'กำลังโหลดผลตรวจสอบการเข้างาน OT...',
      rowCount: '{count} แถว',
      searchPlaceholder: 'ค้นหาพนักงาน ผลลัพธ์ หรือเหตุผล',

      resultLabel: 'ผลลัพธ์',
      meaning: 'ความหมาย',
      employee: 'พนักงาน',
      otType: 'ประเภท OT',
      scanIn: 'สแกนเข้า',
      scanOut: 'สแกนออก',
      status: 'สถานะ',
      creditedOt: 'OT ที่นับได้',
      actual: 'จริง',
      reason: 'เหตุผล',

      fixedOt: 'OT เวลาคงที่',
      afterShift: 'หลังเลิกกะ',
      otOption: 'ตัวเลือก OT',

      noVerificationRows: 'ไม่พบแถวผลการตรวจสอบ',
      emptyInstruction:
        'เลือกวันที่ OT เลือกคำขอ OT แล้วตรวจสอบผลการเข้างาน',

      otDateRequired: 'จำเป็นต้องเลือกวันที่ OT',
      otDateRequiredDetail: 'โปรดเลือกวันที่ OT ก่อน',
      noOtRequests: 'ไม่มีคำขอ OT',
      noOtRequestsDetail:
        'ไม่พบคำขอ OT สำหรับวันที่และสถานะที่เลือก',
      loadFailed: 'โหลดไม่สำเร็จ',
      loadVerificationFailed: 'โหลดผลตรวจสอบการเข้างาน OT ไม่สำเร็จ',
      loadRequestsFailed: 'โหลดคำขอ OT ไม่สำเร็จ',

      noRequestNo: 'ไม่มีเลขที่คำขอ',
      statusPrefix: 'สถานะ',
      staff: 'คน',

      result: {
        match: 'ตรงกัน',
        mismatch: 'ต้องตรวจสอบ',
        pending_review: 'รอตรวจสอบ',
      },

      no_paid_ot_minutes: 'ไม่พบนาที OT ที่จ่ายได้ในคำขอ OT ที่อนุมัติแล้ว',
      approved_without_exact_clock_out:
        'นับ OT ที่อนุมัติตามนโยบายแล้ว พนักงานมาทำงานตามกะปกติ ไม่จำเป็นต้องมีสแกนออกตรงเวลาสิ้นสุด OT แบบเป๊ะ',
      approved_without_exact_clock_out_late:
        'นับ OT ที่อนุมัติตามนโยบายแล้ว พนักงานมาสายแต่ยังมาทำงานตามกะปกติ ไม่จำเป็นต้องมีสแกนออกตรงเวลาสิ้นสุด OT แบบเป๊ะ',
      fixed_ot_approved_without_exact_clock_out:
        'นับ OT เวลาคงที่ตามนโยบายแล้ว พนักงานมาทำงานตามกะปกติ ไม่จำเป็นต้องมีสแกนออกตรงเวลาสิ้นสุด OT แบบเป๊ะ',
      fixed_ot_approved_without_exact_clock_out_late:
        'นับ OT เวลาคงที่ตามนโยบายแล้ว พนักงานมาสายแต่ยังมาทำงานตามกะปกติ ไม่จำเป็นต้องมีสแกนออกตรงเวลาสิ้นสุด OT แบบเป๊ะ',

      forget_scan_in_pending: 'ลืมสแกนเข้า รอตรวจสอบตามนโยบาย OT',
      forget_scan_out_pending:
        'ลืมสแกนออก รอตรวจสอบตามนโยบาย OT',
      attendance_not_present:
        'ไม่สามารถนับ OT ที่อนุมัติได้ เพราะสถานะการเข้างานไม่ใช่มาทำงาน',
      status_requires_manual_review:
        'สถานะการเข้างานต้องตรวจสอบด้วยตนเองก่อนจึงจะนับ OT ได้',

      no_request_window: 'ช่วงเวลาคำขอ OT ขาดหายหรือไม่ถูกต้อง',
      no_attendance_window: 'ช่วงเวลาเข้า/ออกขาดหายหรือไม่ถูกต้อง',

      sunday_holiday_no_overlap:
        'เวลาที่มาทำงานไม่ทับกับคำขอ OT วันอาทิตย์หรือวันหยุด',
      sunday_holiday_below_min:
        'OT วันอาทิตย์หรือวันหยุดต่ำกว่านาทีขั้นต่ำที่มีสิทธิ์',
      sunday_holiday_match:
        'OT วันอาทิตย์หรือวันหยุดตรงกับคำขอที่อนุมัติ',
      sunday_holiday_short:
        'OT วันอาทิตย์หรือวันหยุดน้อยกว่าคำขอที่อนุมัติ',
      sunday_holiday_exceed:
        'OT วันอาทิตย์หรือวันหยุดมากกว่าคำขอที่อนุมัติ',

      policy_not_eligible: 'OT ไม่มีสิทธิ์ตามนโยบายที่เลือก',
      policy_below_min:
        'OT ต่ำกว่านาทีขั้นต่ำที่กำหนดในนโยบาย',
      policy_match: 'OT ตรงกับคำขอที่อนุมัติตามนโยบาย',
      policy_short:
        'OT ที่นับได้น้อยกว่าคำขอที่อนุมัติตามนโยบาย',
      policy_exceed:
        'OT ที่นับได้มากกว่าคำขอที่อนุมัติตามนโยบาย',

      meaningLabel: {
        forgetScanIn: 'ลืมสแกนเข้า',
        forgetScanOut: 'ลืมสแกนออก',
        acceptedByPolicy: 'ยอมรับตามนโยบาย',
        otStaffAbsent: 'พนักงาน OT ขาดงาน',
        wrongShift: 'ผิดกะ',
        notInOtStaff: 'ไม่อยู่ในรายชื่อพนักงาน OT',
        notEligible: 'ไม่มีสิทธิ์ OT',
        otMatchedRequest: 'OT ตรงกับคำขอ',
        absent: 'ขาดงาน',
        missingScanTime: 'เวลาสแกนขาดหาย',
        noCreditedOt: 'ไม่มี OT ที่นับได้',
        creditedLessThanRequest: 'นับได้น้อยกว่าคำขอ',
        creditedOverRequest: 'นับได้มากกว่าคำขอ',
        adjustedByRule: 'ปรับตามกฎ',
        checkOtRule: 'ตรวจสอบกฎ OT',
      },
    },

    validation: {
      invalidId: 'ID ไม่ถูกต้อง',
      dateYmd: 'วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD',
      attendanceDateRequired: 'จำเป็นต้องระบุวันที่เข้างาน',
      attendanceDateToAfterFrom:
        'วันที่เข้างานสิ้นสุดต้องมากกว่าหรือเท่ากับวันที่เข้างานเริ่มต้น',
      periodToAfterFrom:
        'ช่วงสิ้นสุดต้องมากกว่าหรือเท่ากับช่วงเริ่มต้น',
      otDateToAfterFrom:
        'วันที่ OT สิ้นสุดต้องมากกว่าหรือเท่ากับวันที่ OT เริ่มต้น',
    },

    error: {
      importFileRequired: 'จำเป็นต้องมีไฟล์ Excel การเข้างาน',
      importFileInvalid: 'ไฟล์การเข้างานว่างหรือไม่ถูกต้อง',
      unableToReadFile: 'ไม่สามารถอ่านไฟล์การเข้างานได้',
      worksheetMissing: 'ไฟล์การเข้างานไม่มีชีต',
      worksheetEmpty: 'ชีตการเข้างานว่าง',
      headerMissing: 'ไม่พบแถวหัวตารางในชีตการเข้างาน',
      employeeIdColumnRequired:
        'ไฟล์การเข้างานต้องมีคอลัมน์ Employee ID',
      clockInColumnRequired:
        'ไฟล์การเข้างานต้องมีคอลัมน์ Clock In',
      clockOutColumnRequired:
        'ไฟล์การเข้างานต้องมีคอลัมน์ Clock Out',
      importNotFound: 'ไม่พบรายการนำเข้าการเข้างาน',
      recordNotFound: 'ไม่พบรายการเข้างาน',
      otRequestNotFound: 'ไม่พบคำขอ OT',
    },
  },

  ot: {
    common: {
      min: 'นาที',
      minShort: 'น.',
      totalCount: 'รวม {total}',
      hourValue: '{value} ชม.',
      minuteValue: '{value} นาที',
      hourMinuteValue: '{hours} ชม. {minutes} นาที',
    },

    dayType: {
      workingDay: 'วันทำงาน',
      sunday: 'วันอาทิตย์',
      holiday: 'วันหยุด',
    },

    status: {
      pending: 'รอดำเนินการ',
      pendingRequesterConfirmation: 'รอผู้ขอยืนยัน',
      approved: 'อนุมัติแล้ว',
      rejected: 'ปฏิเสธแล้ว',
      requesterDisagreed: 'ผู้ขอไม่เห็นด้วย',
      cancelled: 'ยกเลิกแล้ว',
    },

    approvalDisplay: {
      approved: 'อนุมัติแล้ว',
      rejected: 'ปฏิเสธแล้ว',
      waitingRequesterConfirmation: 'รอผู้ขอยืนยัน',
      requesterDisagreed: 'ผู้ขอไม่เห็นด้วย',
      cancelled: 'ยกเลิกแล้ว',
      waitingApproval: 'รอการอนุมัติ',
    },

    acknowledgement: {
      status: {
        acknowledged: 'รับทราบแล้ว',
        waiting: 'รอรับทราบ',
        pending: 'รอดำเนินการ',
        fyi: 'แจ้งเพื่อทราบ',
      },
    },

    acknowledge: {
      inbox: 'กล่องรับทราบ OT',
      loading: 'กำลังโหลดกล่องรับทราบ',
      fetchingRecords: 'กำลังดึงคำขอ OT ที่ต้องรับทราบ...',
      noData: 'ไม่พบคำขอที่ต้องรับทราบ',
      loadFailed: 'โหลดกล่องรับทราบไม่สำเร็จ',
      acknowledgement: 'การรับทราบ',
      requestStatus: 'สถานะคำขอ',
      fyi: 'แจ้งเพื่อทราบ',
    },

    approval: {
      inbox: 'กล่องอนุมัติ OT',
      approvalStatus: 'สถานะการอนุมัติ',
      staffCount: '{count} คน',
      time: 'เวลา',

      exportExcel: 'ส่งออก Excel',
      approveSelected: 'อนุมัติที่เลือก',
      approveSelectedWithCount: 'อนุมัติที่เลือก ({count})',
      clearSelection: 'ล้างการเลือก',

      loading: 'กำลังโหลดกล่องอนุมัติ',
      fetchingRecords: 'กำลังดึงคำขอ OT ที่ต้องอนุมัติ...',
      noData: 'ไม่พบคำขอ OT ที่ต้องอนุมัติ',
      loadFailed: 'โหลดกล่องอนุมัติไม่สำเร็จ',

      exported: 'ส่งออกแล้ว',
      exportedSuccess: 'ส่งออก Excel กล่องอนุมัติสำเร็จ',
      exportFailed: 'ส่งออกไม่สำเร็จ',

      requestedStaff: 'พนักงานที่ขอ',
      requested: 'ที่ขอ',
      breakTime: 'เวลาพัก',
      totalRequestPaid: 'เวลาที่ขอจ่ายรวม',
      paid: 'จ่าย',
      totalPaid: 'จ่ายรวม',

      legacyManual: 'แบบเดิมกำหนดเอง',
      shiftOption: 'ตัวเลือกตามกะ',

      noSelectedRequests: 'ยังไม่ได้เลือกคำขอ',
      selectAtLeastOne: 'โปรดเลือกคำขอ OT ที่สามารถดำเนินการได้อย่างน้อยหนึ่งรายการ',

      decisionEyebrow: 'การตัดสินใจอนุมัติ OT',
      confirmApproval: 'ยืนยันการอนุมัติ',
      rejectRequest: 'ปฏิเสธคำขอ OT',
      approveQuestion: 'คุณแน่ใจหรือไม่ว่าต้องการอนุมัติ?',
      rejectQuestion: 'คุณแน่ใจหรือไม่ว่าต้องการปฏิเสธ?',
      approveHelp: 'ระบบจะอนุมัติพนักงานทั้งหมดในคำขอ OT นี้',
      rejectHelp: 'ระบบจะปฏิเสธคำขอ OT ทั้งรายการ',

      remark: 'หมายเหตุ',
      optionalApprovalRemark: 'หมายเหตุการอนุมัติ (ไม่บังคับ)',
      rejectionReasonPlaceholder: 'โปรดกรอกเหตุผลการปฏิเสธ',
      rejectionRemarkRequired: 'โปรดกรอกหมายเหตุการปฏิเสธ',
      yesApprove: 'ใช่ อนุมัติ',

      decisionSuccess: 'สำเร็จ',
      approveSuccess: 'อนุมัติคำขอ OT สำเร็จ',
      rejectSuccess: 'ปฏิเสธคำขอ OT สำเร็จ',
      decisionFailed: 'ตัดสินใจไม่สำเร็จ',

      bulkApproval: 'อนุมัติหลายรายการ',
      approveMultiple: 'อนุมัติคำขอ OT หลายรายการ',
      requestCount: '{count} คำขอ',
      bulkWarning:
        'คุณแน่ใจหรือไม่ว่าต้องการอนุมัติคำขอ OT ที่เลือก ระบบจะอนุมัติพนักงานทั้งหมดในแต่ละคำขอที่เลือก',
      bulkRemarkPlaceholder: 'หมายเหตุสำหรับการอนุมัติทั้งหมด (ไม่บังคับ)',
      approveAllSelected: 'อนุมัติทั้งหมดที่เลือก',

      bulkCompleted: 'อนุมัติหลายรายการเสร็จสิ้น',
      bulkPartial: 'อนุมัติสำเร็จ {success}, ล้มเหลว {failed}',
      bulkSuccess: 'อนุมัติคำขอ {count} รายการสำเร็จ',
      bulkFailed: 'อนุมัติหลายรายการไม่สำเร็จ',
      bulkNoApproved: 'ไม่มีคำขอที่ถูกอนุมัติ',
    },    requests: {
      tableTitle: 'รายการคำขอ OT',
      title: 'คำขอ OT',
      createTitle: 'สร้างคำขอ OT',
      editTitle: 'แก้ไขคำขอ OT',
      detailTitle: 'รายละเอียดคำขอ OT',
      approvalTitle: 'กล่องอนุมัติ OT',
      acknowledgeTitle: 'กล่องรับทราบ OT',
      subtitle: 'จัดการคำขอล่วงเวลาโดยใช้ข้อมูลจาก Backend เป็นหลัก',

      requestNo: 'เลขที่คำขอ',
      otDate: 'วันที่ OT',
      otDateFrom: 'วันที่ OT เริ่มต้น',
      otDateTo: 'วันที่ OT สิ้นสุด',
      otTime: 'เวลา OT',
      time: 'เวลา',
      dayType: 'ประเภทวัน',
      otOption: 'ตัวเลือก OT',

      employee: 'พนักงาน',
      employees: 'พนักงาน',
      approver: 'ผู้อนุมัติ',
      requester: 'ผู้ขอ',
      requestedMinutes: 'นาทีที่ขอ',
      paidMinutes: 'นาทีที่จ่าย',
      breakMinutes: 'นาทีพัก',
      break: 'พัก',
      total: 'เวลา OT',
      mode: 'โหมด',

      exportExcel: 'ส่งออก Excel',
      newRequest: 'สร้างคำขอ OT ใหม่',

      deleteConfirmTitle: 'ลบคำขอ OT',
      deleteConfirmHeading: 'ลบคำขอ OT นี้ถาวรหรือไม่?',
      deleteConfirmHelp:
        'การดำเนินการนี้จะลบคำขอ OT และการแจ้งเตือนที่เกี่ยวข้องอย่างถาวร ใช้เฉพาะข้อมูลทดสอบหรือข้อมูลที่ตกลงให้ล้างเท่านั้น',
      deletedSuccess: 'ลบคำขอ OT สำเร็จ',
      deleteFailed: 'ลบไม่สำเร็จ',

      allDayTypes: 'ประเภทวันทั้งหมด',

      loading: 'กำลังโหลดคำขอ OT',
      fetchingRecords: 'กำลังดึงรายการคำขอ OT...',
      noData: 'ไม่พบคำขอ OT',
      loadFailed: 'โหลดคำขอ OT ไม่สำเร็จ',

      exported: 'พร้อมส่งออก',
      exportedSuccess: 'ดาวน์โหลดไฟล์ Excel สำเร็จ',
      exportFailed: 'ส่งออกไม่สำเร็จ',

      approvalStatus: 'สถานะการอนุมัติ',
      staff: 'พนักงาน',
      staffCount: '{count} คน',
      timing: 'เวลา',
      verify: 'ตรวจสอบ',

      preset: 'ตั้งค่าไว้',
      customFixed: 'กำหนดเอง',

      defaultRequestTime: 'เวลาคำขอเริ่มต้น',
      employeeId: 'ID',
      noEmployeeData: 'ไม่พบข้อมูลพนักงานสำหรับคำขอนี้',

      timeMode: {
        default: 'ค่าเริ่มต้น',
        custom: 'กำหนดเอง',
      },

      edit: {
        title: 'แก้ไขคำขอ OT',
        subtitle:
          'ผู้ขอสามารถแก้ไขได้เฉพาะก่อนที่ขั้นตอนการอนุมัติใด ๆ จะถูกอนุมัติ',
        saveChanges: 'บันทึกการเปลี่ยนแปลง',

        loadingDetail: 'กำลังโหลดคำขอ OT...',
        notFound: 'ไม่พบคำขอ OT',

        legacyManualMode: 'โหมดกำหนดเองแบบเดิม',
        shiftOtOptionMode: 'โหมดตัวเลือก OT ตามกะ',

        editForm: 'ฟอร์มแก้ไข',
        currentSummary: 'สรุปปัจจุบัน',
        employeesInRequest: 'พนักงานในคำขอนี้',

        requesterId: 'ID ผู้ขอ',
        startTime: 'เวลาเริ่ม',
        endTime: 'เวลาสิ้นสุด',
        reason: 'เหตุผล',
        approverChain: 'ลำดับผู้อนุมัติ',
        selectApprovers: 'เลือกผู้อนุมัติตามลำดับองค์กร',
        selectOtOption: 'เลือกตัวเลือก OT',

        shiftType: 'ประเภทกะ',
        shiftStart: 'เริ่มกะ',
        shiftEnd: 'สิ้นสุดกะ',

        requestedDuration: 'ระยะเวลาที่ขอ',
        requestStart: 'เริ่มคำขอ',
        requestEnd: 'สิ้นสุดคำขอ',

        currentRequestTime: 'เวลาคำขอปัจจุบัน',
        currentTotalHours: 'ชั่วโมงรวมปัจจุบัน',
        currentOtOption: 'ตัวเลือก OT ปัจจุบัน',

        employeeListNote:
          'เวอร์ชันนี้จะคงรายชื่อพนักงานเดิมไว้ และอัปเดตรายละเอียด OT เหตุผล และลำดับผู้อนุมัติ',

        cannotEditMessage:
          'คำขอ OT นี้ไม่สามารถแก้ไขได้ เพราะไม่อยู่ในสถานะรอดำเนินการแล้ว หรือมีขั้นตอนที่ถูกอนุมัติแล้ว',

        noShiftOption: 'ยังไม่มีตัวเลือก OT ที่ใช้งานสำหรับกะนี้',

        minutesValue: '{value} นาที',

        validationTitle: 'การตรวจสอบ',
        editUnavailableTitle: 'แก้ไขไม่ได้',
        editUnavailableDetail: 'คำขอ OT นี้ไม่สามารถแก้ไขได้แล้ว',
        selectDateRequired: 'โปรดเลือกวันที่ OT',
        reasonRequired: 'โปรดกรอกเหตุผล',
        employeeRequired: 'จำเป็นต้องเลือกพนักงานอย่างน้อย 1 คน',
        approverRequired: 'โปรดเลือกผู้อนุมัติอย่างน้อย 1 คน',
        approverMax: 'คุณเลือกผู้อนุมัติได้สูงสุด 4 คนเท่านั้น',
        startTimeInvalid: 'เวลาเริ่มต้องเป็น HH:mm',
        endTimeInvalid: 'เวลาสิ้นสุดต้องเป็น HH:mm',
        endTimeAfterStart: 'เวลาสิ้นสุดต้องหลังเวลาเริ่ม',
        otOptionRequired: 'โปรดเลือกตัวเลือก OT',

        optionsFailedTitle: 'โหลดตัวเลือก OT ไม่สำเร็จ',
        optionsFailedDetail: 'ไม่สามารถโหลดตัวเลือก OT สำหรับกะนี้ได้',
        loadFailedDetail: 'โหลดคำขอ OT ไม่สำเร็จ',
        updatedSuccess: 'อัปเดตคำขอ OT สำเร็จ',
        updateFailedDetail: 'อัปเดตคำขอ OT ไม่สำเร็จ',
      },

      create: {
        selectedCount: 'เลือกแล้ว {count}',

        selectOtDate: '1. เลือกวันที่ OT',
        timingType: '3. ประเภทเวลา',
        presetOption: 'ตัวเลือกที่ตั้งค่าไว้',
        customFixedTime: 'เวลาคงที่กำหนดเอง',
        otOptionPolicy: '4. ตัวเลือก / นโยบาย OT',
        selectTimingType: 'เลือกประเภทเวลา',
        selectOtOption: 'เลือกตัวเลือก OT',

        customDefaultTime: 'เวลา OT เริ่มต้นแบบกำหนดเอง',
        customDefaultTimeHelp:
          'พนักงานที่เลือกทั้งหมดจะใช้เวลานี้ เว้นแต่มีการปรับแก้ภายหลัง',
        flexible: 'ยืดหยุ่น',

        startTime: 'เวลาเริ่ม',
        endTime: 'เวลาสิ้นสุด',
        breakMinutes: 'นาทีพัก',

        timing: 'เวลา',
        start: 'เริ่ม',
        end: 'สิ้นสุด',
        total: 'รวม',
        submitRequest: 'ส่งคำขอ OT',

        reason: '5. เหตุผล',
        optional: 'ไม่บังคับ',
        reasonPlaceholder:
          'ตัวอย่าง: งานผลิตเร่งด่วน, กำหนดส่งสินค้า...',

        validationTitle: 'ตรวจฟอร์ม',
        waitAvailability: 'โปรดรอจนกว่าการตรวจสอบความพร้อม OT จะเสร็จสิ้น',
        selectDateFirst: 'โปรดเลือกวันที่ OT ก่อน',
        selectAtLeastOneEmployee: 'โปรดเลือกพนักงานอย่างน้อย 1 คน',
        missingShift:
          'พนักงานที่เลือกบางคนยังไม่มีข้อมูลกะ',
        mixedShift:
          'โปรดเลือกพนักงานจากกะเดียวกันเท่านั้นก่อนสร้างคำขอ OT',
        selectOtOptionForDayType: 'โปรดเลือกตัวเลือก OT สำหรับ {dayType}',
        selectOtOptionRequired: 'โปรดเลือกตัวเลือก OT',
        enterCustomStartTime: 'โปรดกรอกเวลาเริ่มแบบกำหนดเอง',
        enterCustomEndTime: 'โปรดกรอกเวลาสิ้นสุดแบบกำหนดเอง',
        customStartInvalid:
          'เวลาเริ่มแบบกำหนดเองต้องเป็น HH:mm เช่น 18:00',
        customEndInvalid:
          'เวลาสิ้นสุดแบบกำหนดเองต้องเป็น HH:mm เช่น 20:00',
        customTimeInvalid: 'เวลาเริ่มและเวลาสิ้นสุดแบบกำหนดเองต้องเป็น HH:mm',
        customTimeSame: 'เวลาเริ่มและเวลาสิ้นสุดแบบกำหนดเองต้องไม่เหมือนกัน',
        breakTooLong:
          'นาทีพักต้องไม่นานกว่าหรือเท่ากับระยะเวลา OT',
        selectValidTiming: 'โปรดเลือกเวลา OT ที่ถูกต้องก่อนส่งคำขอ',
        missingEmployeeStart: 'ไม่มีเวลาเริ่ม OT สำหรับ {employee}',
        missingEmployeeEnd: 'ไม่มีเวลาสิ้นสุด OT สำหรับ {employee}',
        employeeStartInvalid: 'เวลาเริ่ม OT สำหรับ {employee} ไม่ถูกต้อง',
        employeeEndInvalid: 'เวลาสิ้นสุด OT สำหรับ {employee} ไม่ถูกต้อง',
        employeeTimeSame:
          'เวลาเริ่ม OT และเวลาสิ้นสุด OT ต้องไม่เหมือนกันสำหรับ {employee}',
        employeeBreakTooLong:
          'นาทีพักต้องไม่นานกว่าหรือเท่ากับระยะเวลา OT สำหรับ {employee}',

        profileLoadFailed: 'โหลดโปรไฟล์ไม่สำเร็จ',
        profileLoadFailedDetail: 'ไม่สามารถโหลดโปรไฟล์พนักงานของคุณได้',

        availabilityFailed: 'ตรวจสอบความพร้อม OT ไม่สำเร็จ',
        availabilityFailedDetail:
          'ไม่สามารถตรวจสอบพนักงานที่มี OT อยู่แล้วในวันที่นี้ได้',

        optionsFailed: 'โหลดตัวเลือก OT ไม่สำเร็จ',
        optionsFailedDetail:
          'ไม่สามารถโหลดตัวเลือก OT สำหรับกะและวันที่ที่เลือกได้',

        noOptionTitle: 'ไม่มีตัวเลือก OT',
        noOptionForDayType:
          'ไม่พบตัวเลือก OT ที่ใช้งานสำหรับ {dayType} โปรดแจ้งผู้ดูแลระบบให้สร้างก่อน',
        noOptionGeneric: 'ไม่พบตัวเลือก OT ที่ใช้งานสำหรับกะ/วันที่นี้',

        calendarUnavailableTitle: 'ปฏิทินวันหยุดไม่พร้อมใช้งาน',
        calendarUnavailableDetail:
          'ไม่สามารถโหลดปฏิทินวันหยุดภายในได้',

        employeesRemoved: 'นำพนักงานออกแล้ว',
        employeesRemovedDetail:
          'มีพนักงาน {count} คนที่มีคำขอ OT ในวันนี้อยู่แล้ว จึงถูกนำออกจากการเลือก',

        successTitle: 'สร้างแล้ว',
        successMessage: 'สร้างคำขอ OT สำเร็จ',
        createFailedDetail: 'ไม่สามารถสร้างคำขอ OT ได้',

        duplicateTitle: 'พนักงาน OT ซ้ำ',
        duplicateGeneric: 'พนักงานบางคนมีคำขอ OT ในวันที่นี้อยู่แล้ว',
        duplicateDetail:
          'พนักงานเหล่านี้มีคำขอ OT ในวันที่นี้อยู่แล้วและถูกนำออกจากการเลือก: {preview}',
        duplicateDetailMore:
          'พนักงานเหล่านี้มีคำขอ OT ในวันที่นี้อยู่แล้วและถูกนำออกจากการเลือก: {preview}, และอีก {more} คน',

        missingClockInTitle: 'จำเป็นต้องมีเวลาเข้างาน',
        todayAttendanceRequired:
          'OT วันนี้จำเป็นต้องมีเวลาเข้างานก่อนสร้างคำขอ',
        missingClockInDetail:
          'OT วันนี้จำเป็นต้องมีเวลาเข้างาน นำออกจากการเลือกแล้ว: {preview}',
        missingClockInDetailMore:
          'OT วันนี้จำเป็นต้องมีเวลาเข้างาน นำออกจากการเลือกแล้ว: {preview}, และอีก {more} คน',

        accountEmployeeLinkRequired:
          'บัญชีเข้าสู่ระบบของคุณยังไม่ได้เชื่อมกับโปรไฟล์พนักงาน โปรดตรวจสอบการตั้งค่าบัญชีและพนักงาน',
        approverNotFound:
          'ไม่พบผู้อนุมัติ OT ในผังองค์กร โปรดตั้งค่าสายผู้จัดการและกำหนดบทบาท OT = ผู้อนุมัติ',
        duplicateEmployeeDate:
          'พนักงานบางคนมีคำขอ OT ในวันที่นี้อยู่แล้ว',

        timingMode: {
          customFixed: 'เวลาคงที่กำหนดเอง',
          fixedTime: 'เวลาคงที่',
          afterShiftEnd: 'หลังเลิกกะ',
        },

        employeePicker: {
          title: '2. เลือกพนักงาน',
          searchPlaceholder: 'ค้นหา ID, ชื่อ, ไลน์, ตำแหน่ง หรือกะ...',
          scopePlaceholder: 'ขอบเขตพนักงาน',

          myEmployees: 'พนักงานของฉัน',
          allEmployees: 'พนักงานทั้งหมด',
          allLines: 'ไลน์ทั้งหมด',

          noLine: 'ไม่มีไลน์',
          unnamedLine: 'ไลน์ไม่มีชื่อ',
          noShift: 'ไม่มีกะ',
          noEmployeeId: 'ไม่มี ID',

          chooseDateFirst: 'เลือกวันที่ OT ก่อน',
          checkingBlocked:
            'กำลังตรวจพนักงานที่มี OT อยู่แล้วในวันที่นี้...',
          loadingEmployees: 'กำลังโหลดพนักงาน...',
          autoSelecting: 'กำลังเลือกพนักงานในไลน์อัตโนมัติ...',

          emptyTitle: 'ไม่พบพนักงาน',
          emptyText: 'ลองใช้คำค้นหาอื่น ตัวกรองไลน์ หรือขอบเขตพนักงานอื่น',

          staffCount: '{count} คน',
          groupSelectedCount: 'เลือกแล้ว {selected}/{total}',
          unavailableCount: 'ไม่พร้อมใช้งาน {count} คน',
          manualOnly: 'เลือกเองเท่านั้น',
          manualSelect: 'เลือกเอง',
          available: 'พร้อมใช้งาน',
          selected: 'เลือกแล้ว',

          columnStart: 'เริ่ม',
          columnEnd: 'สิ้นสุด',

          resetDefaultTime: 'รีเซ็ตเป็นเวลาเริ่มต้น',
          scrollMoreLocal:
            'เลื่อนภายในไลน์นี้เพื่อแสดงพนักงานเพิ่มเติม...',
          loadingMore: 'กำลังโหลดพนักงานเพิ่มเติม...',
          allMatchedLoaded: 'โหลดพนักงานที่ตรงกันทั้งหมดแล้ว',

          cannotSelectTitle: 'ไม่สามารถเลือกได้',
          noSelectableInGroup: 'ไม่มีพนักงานที่เลือกได้ในกลุ่มนี้',
          cannotSelectEmployeeTitle: 'ไม่สามารถเลือกพนักงานได้',
          cannotEditEmployeeTitle: 'ไม่สามารถแก้ไขพนักงานได้',

          lineFilterUnavailableTitle: 'ตัวกรองไลน์ไม่พร้อมใช้งาน',
          lineFilterUnavailableDetail: 'ไม่สามารถโหลดตัวเลือกตัวกรองไลน์ได้',

          employeeLoadFailedTitle: 'โหลดพนักงานไม่สำเร็จ',
          employeeLoadFailedDetail: 'ไม่สามารถโหลดพนักงานได้',

          autoSelectFailedTitle: 'เลือกอัตโนมัติไม่สำเร็จ',
          autoSelectFailedDetail: 'ไม่สามารถเลือกพนักงานของคุณแบบอัตโนมัติได้',

          unknownError: 'ข้อผิดพลาดที่ไม่ทราบสาเหตุ',
          invalidValue: 'ค่าไม่ถูกต้อง',

          invalidEmployee: 'พนักงานไม่ถูกต้อง',
          alreadyInRequest: 'มีอยู่แล้วในคำขอ OT {requestNo}',
          alreadyUnavailable: 'ไม่พร้อมใช้งานสำหรับวันที่นี้อยู่แล้ว',
          employeeNoShift: 'พนักงานไม่มีกะ',
          shiftMismatch: 'กะของพนักงานไม่ตรงกับกะที่เลือก',
        },
      },
    },    policy: {
      tableTitle: 'นโยบายการคำนวณ OT',
      subtitle:
        'กฎการคำนวณ OT จาก Backend ใช้กับตัวเลือก OT ตามกะและการตรวจสอบการจ่ายเงิน',
      searchPlaceholder: 'ค้นหารหัส ชื่อ หรือคำอธิบาย',

      newPolicy: 'สร้างนโยบายใหม่',
      createTitle: 'สร้างนโยบาย OT',
      editTitle: 'แก้ไขนโยบาย OT',

      policy: 'นโยบาย',
      rounding: 'การปัดเศษ',
      eligibility: 'เงื่อนไขการมีสิทธิ์',
      behavior: 'พฤติกรรม',
      forgetScan: 'ลืมสแกน',

      behaviorFlags: 'ตัวเลือกพฤติกรรม',
      flagValue: '{label}: {value}',

      allMethods: 'ทุกวิธี',
      roundMethodLabel: 'วิธีปัดเศษ',
      minEligible: 'ขั้นต่ำที่มีสิทธิ์',
      roundUnit: 'หน่วยปัดเศษ',
      graceAfterShiftEnd: 'เวลาผ่อนผันหลังเลิกกะ',

      minEligibleShort: 'ขั้นต่ำ',
      graceShort: 'ผ่อนผัน',
      everyUnit: 'ทุก {unit}',

      codePlaceholder: 'ตัวอย่าง: POST_SHIFT_STD_30M',
      namePlaceholder: 'ตัวอย่าง: นโยบายหลังเลิกกะ ปัดขึ้นทุก 30 นาที',
      descriptionPlaceholder: 'หมายเหตุสำหรับผู้ดูแลระบบ (ไม่บังคับ)',
      activeHelp: 'นโยบายที่ใช้งานสามารถนำไปใช้กับตัวเลือก OT ตามกะใหม่ได้',

      loading: 'กำลังโหลดนโยบาย OT',
      noData: 'ไม่พบนโยบาย OT ที่ตรงกับตัวกรอง',
      loadFailed: 'โหลดนโยบาย OT ไม่สำเร็จ',
      saveFailed: 'บันทึกนโยบาย OT ไม่สำเร็จ',
      createdSuccess: 'สร้างนโยบาย OT สำเร็จ',
      updatedSuccess: 'อัปเดตนโยบาย OT สำเร็จ',

      roundMethod: {
        floor: 'ปัดลง',
        ceil: 'ปัดขึ้น',
        nearest: 'ปัดใกล้ที่สุด',
      },

      flag: {
        allowPreShiftOT: 'ก่อนกะ',
        allowPostShiftOT: 'หลังกะ',
        capByRequestedMinutes: 'จำกัดตามเวลาที่ขอ',
        treatForgetScanInAsPending: 'ลืมสแกนเข้าให้รอตรวจสอบ',
        treatForgetScanOutAsPending: 'ลืมสแกนออกให้รอตรวจสอบ',
        allowApprovedOtWithoutExactClockOut: 'ไม่ต้องมีเวลาออกตรงเป๊ะ',
      },

      flagHelp: {
        allowPreShiftOT: 'อนุญาต OT ก่อนเวลาเริ่มกะ',
        allowPostShiftOT: 'อนุญาต OT หลังเวลาเลิกกะ',
        capByRequestedMinutes: 'ไม่จ่ายมากกว่าเวลา OT ที่ขอ',
        treatForgetScanInAsPending: 'ต้องตรวจสอบเมื่อไม่มีเวลาเข้า',
        treatForgetScanOutAsPending:
          'ต้องตรวจสอบเมื่อไม่มีเวลาออก',
        allowApprovedOtWithoutExactClockOut:
          'อนุญาตให้จ่าย OT ที่อนุมัติแล้ว แม้ไม่มีเวลาออกตรงเป๊ะ เมื่อเป็นไปตามนโยบาย',
      },

      short: {
        allowPreShiftOT: 'ก่อน',
        allowPostShiftOT: 'หลัง',
        capByRequestedMinutes: 'จำกัด',
        treatForgetScanInAsPending: 'ลืมเข้า',
        treatForgetScanOutAsPending: 'ลืมออก',
        allowApprovedOtWithoutExactClockOut: 'ไม่ต้องออกตรง',
      },

      flagShort: {
        pre: 'ก่อน {value}',
        post: 'หลัง {value}',
        cap: 'จำกัด {value}',
        noExactOut: 'ไม่ต้องออกตรง {value}',
        fsIn: 'ลืมเข้า {value}',
        fsOut: 'ลืมออก {value}',
      },

      validation: {
        codeRequired: 'จำเป็นต้องระบุรหัสนโยบาย',
        codeTooLong: 'รหัสนโยบายต้องไม่เกิน 50 ตัวอักษร',
        nameRequired: 'จำเป็นต้องระบุชื่อนโยบาย',
        nameTooLong: 'ชื่อนโยบายต้องไม่เกิน 150 ตัวอักษร',
        descriptionTooLong:
          'คำอธิบายต้องไม่เกิน 1000 ตัวอักษร',
        roundMethodRequired: 'จำเป็นต้องระบุวิธีปัดเศษ',
        roundMethodInvalid: 'วิธีปัดเศษต้องเป็น Floor, Ceil หรือ Nearest',
        roundUnitInvalid: 'หน่วยปัดเศษต้องมีอย่างน้อย 1 นาที',
        roundUnitMinutesInvalid: 'หน่วยปัดเศษต้องมีอย่างน้อย 1 นาที',
        minEligibleInvalid: 'นาทีขั้นต่ำที่มีสิทธิ์ต้องไม่ติดลบ',
        minEligibleMinutesInvalid:
          'นาทีขั้นต่ำที่มีสิทธิ์ต้องไม่ติดลบ',
        graceInvalid: 'นาทีผ่อนผันต้องไม่ติดลบ',
        graceAfterShiftEndMinutesInvalid:
          'นาทีผ่อนผันหลังเลิกกะต้องไม่ติดลบ',
        updatePayloadRequired: 'โปรดอัปเดตอย่างน้อยหนึ่งช่อง',
      },

      error: {
        codeExists: 'รหัสนโยบาย OT มีอยู่แล้ว',
        notFound: 'ไม่พบนโยบาย OT',
        notFoundOrInactive: 'ไม่พบนโยบาย OT หรือไม่ได้ใช้งาน',
        inactive: 'นโยบาย OT ไม่ได้ใช้งาน',
      },
    },

    shiftOption: {
      tableTitle: 'ตัวเลือก OT ตามกะ',
      subtitle:
        'จัดการตัวเลือก OT ตามกะ ประเภทวัน โหมดเวลา และนโยบายการคำนวณ',
      searchPlaceholder: 'ค้นหากะ ชื่อตัวเลือก นโยบาย หรือโหมดเวลา',

      newOption: 'สร้างตัวเลือกใหม่',
      createTitle: 'สร้างตัวเลือก OT ตามกะ',
      editTitle: 'แก้ไขตัวเลือก OT ตามกะ',

      allShifts: 'กะทั้งหมด',
      allPolicies: 'นโยบายทั้งหมด',
      allTimingModes: 'โหมดเวลาทั้งหมด',
      allDayTypes: 'ประเภทวันทั้งหมด',

      optionLabel: 'ชื่อตัวเลือก',
      dayType: 'ประเภทวัน',
      timingMode: 'โหมดเวลา',
      otWindow: 'ช่วงเวลา OT',
      requested: 'ที่ขอ',
      break: 'พัก',
      paid: 'จ่าย',
      policy: 'นโยบายการคำนวณ',
      sequence: 'ลำดับ',

      selectShift: 'เลือกกะ',
      selectPolicy: 'เลือกนโยบายการคำนวณ',
      labelPlaceholder: 'ตัวอย่าง: OT เย็น 18:00 - 20:00',

      applicableDayTypes: 'ประเภทวันที่ใช้ได้',
      selectDayTypes: 'เลือกประเภทวัน',
      startAfterShiftEnd: 'เริ่มหลังเลิกกะ',
      startAfterShiftEndHelp:
        'Backend จะใช้เวลาเลิกกะที่เลือกบวกกับค่านี้เพื่อสร้างช่วงเวลา OT',
      requestedMinutes: 'นาทีที่ขอ',
      fixedStartTime: 'เวลาเริ่มคงที่',
      fixedEndTime: 'เวลาสิ้นสุดคงที่',
      activeHelp: 'ตัวเลือกที่ไม่ใช้งานจะไม่สามารถใช้กับคำขอ OT ใหม่ได้',

      timing: {
        afterShiftEnd: 'หลังเลิกกะ',
        fixedTime: 'เวลาคงที่',
      },

      timingModeLabel: {
        afterShiftEnd: 'หลังเลิกกะ',
        fixedTime: 'เวลาคงที่',
      },

      afterShiftOffset: 'หลังเลิกกะ {offset}',
      roundEvery: 'ปัดทุก {unit}',
      minEligibleValue: 'ขั้นต่ำ {value}',

      noData: 'ไม่พบตัวเลือก OT ตามกะที่ตรงกับตัวกรอง',
      loadFailed: 'โหลดตัวเลือก OT ตามกะไม่สำเร็จ',
      saveFailed: 'บันทึกตัวเลือก OT ตามกะไม่สำเร็จ',
      createdSuccess: 'สร้างตัวเลือก OT ตามกะสำเร็จ',
      updatedSuccess: 'อัปเดตตัวเลือก OT ตามกะสำเร็จ',
      shiftLookupFailed: 'โหลดตัวเลือกกะไม่สำเร็จ',
      policyLookupFailed: 'โหลดตัวเลือกนโยบายไม่สำเร็จ',

      validation: {
        required: 'โปรดเลือกตัวเลือก OT',
        shiftRequired: 'จำเป็นต้องระบุกะ',
        labelRequired: 'จำเป็นต้องระบุชื่อตัวเลือก',
        labelTooLong: 'ชื่อตัวเลือกต้องไม่เกิน 100 ตัวอักษร',
        timingModeRequired: 'จำเป็นต้องระบุโหมดเวลา',
        timingModeInvalid: 'โหมดเวลาไม่ถูกต้อง',
        dayTypeInvalid: 'ประเภทวันไม่ถูกต้อง',
        applicableDayTypesRequired:
          'โปรดเลือกประเภทวันที่ใช้ได้อย่างน้อยหนึ่งรายการ',
        applicableDayTypesTooMany:
          'คุณเลือกประเภทวันที่ใช้ได้สูงสุด 3 รายการเท่านั้น',
        dayTypesRequired: 'โปรดเลือกประเภทวันที่ใช้ได้อย่างน้อยหนึ่งรายการ',
        policyRequired: 'จำเป็นต้องระบุนโยบายการคำนวณ',
        requestedMinutesInvalid: 'นาทีที่ขอต้องมีอย่างน้อย 1 นาที',
        sequenceInvalid: 'ลำดับต้องมีค่าอย่างน้อย 1',
        startAfterShiftEndInvalid:
          'นาทีเริ่มหลังเลิกกะต้องไม่ติดลบ',
        startAfterShiftEndMinutesInvalid:
          'นาทีเริ่มหลังเลิกกะต้องไม่ติดลบ',
        fixedStartTimeInvalid: 'เวลาเริ่มคงที่ต้องใช้รูปแบบ HH:mm',
        fixedEndTimeInvalid: 'เวลาสิ้นสุดคงที่ต้องใช้รูปแบบ HH:mm',
        fixedTimeSame: 'เวลาเริ่มคงที่และเวลาสิ้นสุดคงที่ต้องไม่เหมือนกัน',
        fixedTimeRequired:
          'ตัวเลือก OT แบบเวลาคงที่ต้องมีเวลาเริ่มและเวลาสิ้นสุดคงที่',
        breakMinutesInvalid: 'นาทีพักต้องเป็นจำนวนเต็มที่ไม่ติดลบ',
        breakMinutesTooLarge:
          'นาทีพักต้องไม่นานกว่าหรือเท่ากับระยะเวลา OT',
        updatePayloadRequired: 'โปรดอัปเดตอย่างน้อยหนึ่งช่อง',
      },

      error: {
        notFound: 'ไม่พบตัวเลือก OT ตามกะ',
        duplicate: 'มีตัวเลือก OT ที่ใช้งานซ้ำสำหรับกะนี้',
        labelExists: 'ชื่อตัวเลือก OT ที่ใช้งานมีอยู่แล้วสำหรับกะนี้',
        sequenceExists:
          'ลำดับตัวเลือก OT ที่ใช้งานมีอยู่แล้วสำหรับกะและประเภทวันนี้',
        dayTypeMismatch:
          'ตัวเลือก OT ที่เลือกไม่สามารถใช้กับวันที่ OT นี้ได้',
        shiftMismatch:
          'ตัวเลือก OT ที่เลือกไม่ได้อยู่ในกะที่กำหนดให้พนักงาน',
      },
    },

    request: {
      validation: {
        otDateRequired: 'จำเป็นต้องระบุวันที่ OT',
        employeeRequired: 'โปรดเลือกพนักงานอย่างน้อย 1 คน',
        employeeIdsInvalid: 'รายการพนักงานไม่ถูกต้อง',
        employeeMaxExceeded: 'คุณเลือกพนักงานได้สูงสุด 200 คนเท่านั้น',
        employeeOverrideMaxExceeded:
          'คุณสามารถกำหนดเวลาเองได้สูงสุด 200 คนเท่านั้น',

        timingSourceInvalid: 'แหล่งที่มาของเวลา OT ไม่ถูกต้อง',
        shiftOtOptionRequired: 'โปรดเลือกตัวเลือก OT',

        customFixedTimeRequired:
          'จำเป็นต้องระบุเวลาเริ่มและเวลาสิ้นสุด OT แบบกำหนดเอง',
        customStartTimeRequired: 'จำเป็นต้องระบุเวลาเริ่มแบบกำหนดเอง',
        customEndTimeRequired: 'จำเป็นต้องระบุเวลาสิ้นสุดแบบกำหนดเอง',
        customTimeSame: 'เวลาเริ่มและเวลาสิ้นสุดแบบกำหนดเองต้องไม่เหมือนกัน',

        breakMinutesInvalid: 'นาทีพักต้องเป็นจำนวนเต็มที่ไม่ติดลบ',
        breakMinutesTooLarge:
          'นาทีพักต้องไม่นานกว่าหรือเท่ากับระยะเวลา OT',

        reasonTooLong: 'เหตุผลต้องไม่เกิน 2000 ตัวอักษร',
        remarkTooLong: 'หมายเหตุต้องไม่เกิน 1000 ตัวอักษร',

        overrideTimeSame:
          'เวลาเริ่มและเวลาสิ้นสุดแบบกำหนดเองของพนักงานต้องไม่เหมือนกัน',
        overrideEmployeeNotSelected:
          'สามารถกำหนดเวลาเองได้เฉพาะพนักงานที่เลือกไว้เท่านั้น',
        overrideEmployeeDuplicate:
          'พบพนักงานซ้ำในรายการกำหนดเวลาเอง',

        statusInvalid: 'สถานะ OT ไม่ถูกต้อง',
        dayTypeInvalid: 'ประเภทวัน OT ไม่ถูกต้อง',
        approvalActionInvalid: 'การดำเนินการอนุมัติไม่ถูกต้อง',
        rejectionReasonRequired: 'โปรดกรอกเหตุผลการปฏิเสธ',
        requesterConfirmationActionInvalid:
          'การยืนยันของผู้ขอไม่ถูกต้อง',
      },

      error: {
        notFound: 'ไม่พบคำขอ OT',
        requesterEmployeeRequired: 'จำเป็นต้องมีโปรไฟล์พนักงานของผู้ขอ',
        approverNotFound: 'ไม่พบผู้อนุมัติ OT ในผังองค์กร',
        approverInactive: 'ผู้อนุมัติไม่ได้ใช้งาน',
        employeeDuplicateDate:
          'พนักงานบางคนมีคำขอ OT ในวันที่นี้อยู่แล้ว',
        todayAttendanceTimeInRequired:
          'ไม่สามารถสร้างคำขอ OT สำหรับวันนี้ได้ เพราะพนักงานบางคนยังไม่มีเวลาเข้างาน',
        editNotAllowed: 'คำขอ OT นี้ไม่สามารถแก้ไขได้',
        confirmNotAllowed:
          'การยืนยันของผู้ขอไม่สามารถใช้ได้กับคำขอ OT นี้',
        onlyPendingCanDecide: 'สามารถตัดสินใจได้เฉพาะคำขอ OT ที่รอดำเนินการ',
        currentApprovalStepNotFound: 'ไม่พบขั้นตอนการอนุมัติปัจจุบัน',
        currentStepNotApprover:
          'ขั้นตอนปัจจุบันไม่ใช่ขั้นตอนของผู้อนุมัติ',
        notWaitingForYourApproval:
          'คำขอ OT นี้ไม่ได้รอการอนุมัติจากคุณ',
        noEmployeesToApprove: 'คำขอ OT นี้ไม่มีพนักงานให้อนุมัติ',
        noAdjustedEmployeeList:
          'ไม่มีรายการพนักงานที่ปรับแล้วให้ยืนยัน',
        employeeShiftRequired:
          'พนักงานที่เลือกทั้งหมดต้องมีกะที่กำหนดไว้',
        employeeShiftMismatch:
          'พนักงานที่เลือกทั้งหมดต้องอยู่ในกะเดียวกัน',
      },
    },
  },

  payment: {
    title: 'การจ่ายเงิน',
    processTitle: 'ประมวลผลการจ่ายเงิน',
    formulasTitle: 'สูตรการจ่ายเงิน',
    preview: 'พรีวิว',
    calculateExport: 'คำนวณและส่งออก',
    salaryTemplate: 'เทมเพลตเงินเดือน',

    dayTypes: {
      workingDay: 'วันทำงาน',
      sunday: 'วันอาทิตย์',
      holiday: 'วันหยุด',
    },

    salary_file_required: 'จำเป็นต้องมีไฟล์ Excel เงินเดือน',
    salary_file_invalid: 'ไฟล์ Excel เงินเดือนว่างหรือไม่ถูกต้อง',

    attendance: {
      no_verification_result:
        'ไม่พบผลการตรวจสอบการเข้างานสำหรับพนักงานคนนี้',
    },

    formula: {
      invalid_id: 'ID สูตรการจ่ายเงินไม่ถูกต้อง',
      not_found: 'ไม่พบสูตรการจ่ายเงิน',
      inactive: 'สูตรการจ่ายเงินไม่ได้ใช้งาน',
      code_required: 'จำเป็นต้องระบุรหัสสูตรการจ่ายเงิน',
      code_already_exists: 'รหัสสูตรการจ่ายเงินมีอยู่แล้ว',
    },

    exchange_rate: {
      invalid_id: 'ID อัตราแลกเปลี่ยนการจ่ายเงินไม่ถูกต้อง',
      not_found: 'ไม่พบอัตราแลกเปลี่ยนการจ่ายเงิน',
      inactive: 'อัตราแลกเปลี่ยนการจ่ายเงินไม่ได้ใช้งาน',
      currency_mismatch:
        'สกุลเงินของสูตรการจ่ายเงินไม่ตรงกับสกุลเงินต้นทางของอัตราแลกเปลี่ยน',
      target_must_be_khr: 'สกุลเงินปลายทางของอัตราแลกเปลี่ยนต้องเป็น KHR',
    },

    formulas: {
      tableTitle: 'รายการสูตรการจ่ายเงิน',
      searchPlaceholder: 'ค้นหารหัส ชื่อ สกุลเงิน หรือคำอธิบาย',

      newFormula: 'สร้างสูตรใหม่',
      createTitle: 'สร้างสูตรการจ่ายเงิน',
      editTitle: 'แก้ไขสูตรการจ่ายเงิน',

      formulaName: 'ชื่อสูตร',
      baseRule: 'กฎพื้นฐาน',
      multipliers: 'ตัวคูณ',
      round: 'ปัดเศษ',
      currency: 'สกุลเงิน',

      daysPerMonth: 'วัน / เดือน',
      hoursPerDay: 'ชั่วโมง / วัน',
      hoursPerDayField: 'ชั่วโมง / วัน',
      decimals: 'ทศนิยม',

      workingDays: 'วันทำงาน',
      roundDecimals: 'จำนวนทศนิยมที่ปัด',
      dayTypeMultipliers: 'ตัวคูณตามประเภทวัน',

      codePlaceholder: 'ตัวอย่าง: STD_OT_2026',
      namePlaceholder: 'ตัวอย่าง: สูตร OT มาตรฐาน 2026',
      descriptionPlaceholder: 'คำอธิบายสูตร (ไม่บังคับ)',

      dialogNote:
        'การตั้งค่าสูตรจะถูกบันทึก แต่ไฟล์เงินเดือน Excel และผลการจ่ายเงินที่สร้างขึ้นจะไม่ถูกบันทึก',
      previewTitle: 'พรีวิวสูตร',
      hourlyRatePreview:
        'อัตราต่อชั่วโมง = เงินเดือนต่อเดือน ÷ วันทำงาน ÷ ชั่วโมงต่อวัน',
      otAmountPreview:
        'ยอด OT = ชั่วโมง OT ที่จ่ายได้ × อัตราต่อชั่วโมง × ตัวคูณตามประเภทวัน',

      noData: 'ไม่พบสูตรการจ่ายเงินที่ตรงกับตัวกรอง',
      loadFailed: 'โหลดสูตรการจ่ายเงินไม่สำเร็จ',
      saveFailed: 'บันทึกสูตรการจ่ายเงินไม่สำเร็จ',
      createdSuccess: 'สร้างสูตรการจ่ายเงินสำเร็จ',
      updatedSuccess: 'อัปเดตสูตรการจ่ายเงินสำเร็จ',

      validation: {
        codeRequired: 'จำเป็นต้องระบุรหัส',
        codeTooLong: 'รหัสยาวเกินไป',
        nameRequired: 'จำเป็นต้องระบุชื่อ',
        nameTooLong: 'ชื่อยาวเกินไป',
        descriptionTooLong: 'คำอธิบายยาวเกินไป',
        monthlyWorkingDaysRequired: 'จำเป็นต้องระบุวันทำงานต่อเดือน',
        monthlyWorkingDaysInvalid:
          'วันทำงานต่อเดือนต้องมากกว่า 0',
        hoursPerDayRequired: 'จำเป็นต้องระบุชั่วโมงต่อวัน',
        hoursPerDayInvalid: 'ชั่วโมงต่อวันต้องมากกว่า 0',
        workingDayMultiplierInvalid:
          'ตัวคูณวันทำงานต้องไม่ติดลบ',
        sundayMultiplierInvalid: 'ตัวคูณวันอาทิตย์ต้องไม่ติดลบ',
        holidayMultiplierInvalid: 'ตัวคูณวันหยุดต้องไม่ติดลบ',
        roundingInvalid: 'จำนวนทศนิยมต้องอยู่ระหว่าง 0 ถึง 6',
        updatePayloadRequired: 'จำเป็นต้องระบุอย่างน้อยหนึ่งช่อง',
      },

      error: {
        invalidId: 'ID สูตรการจ่ายเงินไม่ถูกต้อง',
        notFound: 'ไม่พบสูตรการจ่ายเงิน',
        inactive: 'สูตรการจ่ายเงินไม่ได้ใช้งาน',
        codeRequired: 'จำเป็นต้องระบุรหัสสูตรการจ่ายเงิน',
        codeAlreadyExists: 'รหัสสูตรการจ่ายเงินมีอยู่แล้ว',
      },
    },

    exchangeRates: {
      tableTitle: 'อัตราแลกเปลี่ยนการจ่ายเงิน',
      newExchangeRate: 'สร้างอัตราใหม่',
      createTitle: 'สร้างอัตราแลกเปลี่ยน',
      editTitle: 'แก้ไขอัตราแลกเปลี่ยน',

      searchPlaceholder: 'ค้นหารหัส ชื่อ สกุลเงิน หรือคำอธิบาย',

      noData: 'ไม่พบอัตราแลกเปลี่ยน',
      loadFailed: 'โหลดอัตราแลกเปลี่ยนการจ่ายเงินไม่สำเร็จ',
      saveFailed: 'บันทึกอัตราแลกเปลี่ยนการจ่ายเงินไม่สำเร็จ',
      createdSuccess: 'สร้างอัตราแลกเปลี่ยนสำเร็จ',
      updatedSuccess: 'อัปเดตอัตราแลกเปลี่ยนสำเร็จ',

      rateName: 'ชื่ออัตรา',
      currencyPair: 'คู่สกุลเงิน',
      rate: 'อัตรา',
      rounding: 'การปัดเศษ',
      mode: 'โหมด',
      unit: 'หน่วย',
      fromCurrency: 'จากสกุลเงิน',
      toCurrency: 'เป็นสกุลเงิน',
      roundingUnit: 'หน่วยปัดเศษ',
      roundingMode: 'โหมดปัดเศษ',
      denominations: 'ชนิดธนบัตร/เหรียญ',

      codePlaceholder: 'ตัวอย่าง: KHR_4020',
      namePlaceholder: 'ตัวอย่าง: USD เป็น KHR 4020',
      descriptionPlaceholder: 'หมายเหตุสำหรับอัตราแลกเปลี่ยนนี้ (ไม่บังคับ)',

      dialogNote:
        'อัตราแลกเปลี่ยนถูกจัดการแยกจากสูตรการจ่ายเงิน สร้างอัตราที่ต้องการ แล้วเลือกใช้ตอนประมวลผลการจ่ายเงิน',

      roundingPreviewTitle: 'พฤติกรรมการปัดเศษ',
      roundRulePreview:
        'ปัดตาม 100 หมายถึง 101–149 จะเป็น 100 และ 150–199 จะเป็น 200',
      cashBreakdownPreview:
        'ชนิดธนบัตร/เหรียญจะถูกใช้เพื่อคำนวณการแตกธนบัตรจากมูลค่ามากไปน้อย',

      roundingModes: {
        round: 'ปัดใกล้ที่สุด',
        ceil: 'ปัดขึ้น',
        floor: 'ปัดลง',
        none: 'ไม่ปัดเศษ',
      },

      validation: {
        codeRequired: 'จำเป็นต้องระบุรหัส',
        codeTooLong: 'รหัสต้องไม่เกิน 50 ตัวอักษร',
        nameRequired: 'จำเป็นต้องระบุชื่อ',
        nameTooLong: 'ชื่อต้องไม่เกิน 150 ตัวอักษร',
        descriptionTooLong:
          'คำอธิบายต้องไม่เกิน 1000 ตัวอักษร',
        fromCurrencyRequired: 'จำเป็นต้องระบุสกุลเงินต้นทาง',
        toCurrencyRequired: 'จำเป็นต้องระบุสกุลเงินปลายทาง',
        rateRequired: 'จำเป็นต้องระบุอัตรา',
        ratePositive: 'อัตราต้องมากกว่า 0',
        roundingUnitPositive: 'หน่วยปัดเศษต้องมากกว่า 0',
        roundingModeInvalid: 'โหมดปัดเศษไม่ถูกต้อง',
        denominationsRequired: 'จำเป็นต้องมีชนิดธนบัตร/เหรียญอย่างน้อยหนึ่งรายการ',
        updatePayloadRequired: 'ไม่มีข้อมูลสำหรับอัปเดต',
      },

      error: {
        invalidId: 'ID อัตราแลกเปลี่ยนการจ่ายเงินไม่ถูกต้อง',
        notFound: 'ไม่พบอัตราแลกเปลี่ยนการจ่ายเงิน',
        inactive: 'อัตราแลกเปลี่ยนการจ่ายเงินไม่ได้ใช้งาน',
        codeRequired: 'จำเป็นต้องระบุรหัส',
        codeExists: 'รหัสอัตราแลกเปลี่ยนมีอยู่แล้ว',
      },
    },

    process: {
      field: {
        paymentFormula: 'สูตรการจ่ายเงิน',
        exchangeRate: 'อัตราแลกเปลี่ยน',
        noExchangeRate: 'ยังไม่ได้เลือกอัตราแลกเปลี่ยน',
        salaryExcel: 'Excel เงินเดือน',
        noFile: 'ยังไม่ได้เลือกไฟล์',
        formula: 'สูตร',
        workingDays: 'วันทำงาน',
        hoursPerDay: 'ชั่วโมงต่อวัน',
        month: 'เดือน',
        hours: 'ชั่วโมง',
        multipliers: 'ตัวคูณ',
        calculation: 'การคำนวณ',
      },

      action: {
        uploadSalary: 'อัปโหลดเงินเดือน',
        changeFile: 'เปลี่ยนไฟล์',
        template: 'เทมเพลต',
        preview: 'พรีวิว',
        generate: 'สร้างไฟล์',
        loadMore: 'โหลดเพิ่มเติม',
      },

      card: {
        processingTitle: 'ประมวลผลการจ่ายเงิน',
        formulaTitle: 'พรีวิวสูตร',
      },

      status: {
        previewReady: 'พรีวิวพร้อมแล้ว',
        notPreviewed: 'ยังไม่ได้พรีวิว',
        ready: 'พร้อม',
      },

      note: {
        notSaved:
          'ไฟล์เงินเดือน ผลพรีวิว และไฟล์จ่ายเงินสุดท้ายจะไม่ถูกบันทึก หากดาวน์โหลดไม่สำเร็จ ให้อัปโหลดเงินเดือนและสร้างไฟล์อีกครั้ง',
      },

      calendar: {
        title: 'ตรวจปฏิทินภายใน',
        loading: 'กำลังโหลดปฏิทิน',
        holidayCount: 'วันหยุด {count} วัน',
        workingDays: 'วันทำงาน',
        sundays: 'วันอาทิตย์',
        internalHolidays: 'วันหยุดภายใน',
      },

      preview: {
        title: 'พรีวิวการจ่ายเงิน',
      },

      summary: {
        payableEmployees: 'พนักงานที่ต้องจ่าย',
        totalOtHours: 'ชั่วโมง OT รวม',
        totalAmount: 'ยอดรวม',
        totalUsd: 'รวม USD',
        totalKhr: 'รวม KHR',
        missingSalary: 'เงินเดือนขาดหาย',
        warnings: 'คำเตือน',
      },

      table: {
        setup: 'ตั้งค่าการจ่ายเงิน',
        detail: 'รายละเอียดการจ่ายเงิน',
        missingSalary: 'เงินเดือนขาดหาย',
        warnings: 'คำเตือน',
      },

      column: {
        type: 'ประเภท',
        row: 'แถว',

        requestNo: 'เลขที่คำขอ',
        otOption: 'ตัวเลือก OT',
        otTime: 'เวลา OT',
        paymentDayType: 'ประเภทวัน',

        employeeId: 'ID พนักงาน',
        employeeName: 'ชื่อพนักงาน',

        requested: 'ที่ขอ',
        break: 'พัก',
        payable: 'ต้องจ่าย',
        otHours: 'ชั่วโมง OT',

        salary: 'เงินเดือน',
        hourlyRate: 'อัตราต่อชั่วโมง',
        multiplier: 'ตัวคูณ',
        amount: 'จำนวนเงิน',
        amountUsd: 'จำนวนเงิน USD',

        exchangeRate: 'อัตรา',
        rawKhr: 'KHR ดิบ',
        roundedKhr: 'KHR หลังปัดเศษ',
        roundDiffKhr: 'ส่วนต่างการปัดเศษ',

        salaryFound: 'พบเงินเดือน',
        currency: 'สกุลเงิน',
        decision: 'การตัดสินใจ',
        reason: 'เหตุผล',
      },

      label: {
        cappedByRequestPaid: 'จำกัดตามเวลาจ่ายที่ขอ',
        backendCalculated: 'คำนวณโดย Backend',
      },

      empty: {
        noFormula: 'ยังไม่ได้เลือกสูตร',
        selectFormula: 'เลือกสูตรการจ่ายเงินที่ใช้งานก่อนพรีวิว',
        selectFormulaFirst: 'เลือกสูตรก่อน',
        noPaymentDetail: 'ไม่พบรายละเอียดการจ่ายเงินที่ต้องจ่าย',
        noMissingSalary: 'ไม่มีเงินเดือนที่ขาดหาย',
        noWarnings: 'ไม่มีคำเตือน',
        previewTitle: 'ยังไม่มีพรีวิวการจ่ายเงิน',
        previewHint:
          'อัปโหลด Excel เงินเดือนแล้วคลิกพรีวิวเพื่อดูผลการจ่ายเงินก่อนดาวน์โหลด',
      },

      validation: {
        fromDateRequired: 'จำเป็นต้องระบุวันที่เริ่มต้น',
        toDateRequired: 'จำเป็นต้องระบุวันที่สิ้นสุด',
        formulaRequired: 'จำเป็นต้องเลือกสูตรการจ่ายเงิน',
        exchangeRateRequired: 'จำเป็นต้องเลือกอัตราแลกเปลี่ยน',
        salaryRequired: 'จำเป็นต้องมีไฟล์ Excel เงินเดือน',
        invalidDateRange: 'วันที่เริ่มต้นต้องไม่หลังวันที่สิ้นสุด',
        dateYmd: 'วันที่ต้องอยู่ในรูปแบบ YYYY-MM-DD',
        invalidFormulaId: 'ID สูตรการจ่ายเงินไม่ถูกต้อง',
        invalidExchangeRateId: 'ID อัตราแลกเปลี่ยนการจ่ายเงินไม่ถูกต้อง',
        toDateAfterFrom:
          'วันที่สิ้นสุดต้องมากกว่าหรือเท่ากับวันที่เริ่มต้น',
      },

      message: {
        loadFormulasFailed: 'โหลดสูตรการจ่ายเงินไม่สำเร็จ',
        loadExchangeRatesFailed: 'โหลดอัตราแลกเปลี่ยนการจ่ายเงินไม่สำเร็จ',

        calendarFailedTitle: 'โหลดปฏิทินไม่สำเร็จ',
        calendarFailed: 'โหลดปฏิทินวันหยุดภายในไม่สำเร็จ',

        invalidFileTitle: 'ไฟล์ไม่ถูกต้อง',
        invalidFile: 'โปรดอัปโหลดเฉพาะไฟล์ Excel: .xlsx หรือ .xls',

        downloadedTitle: 'ดาวน์โหลดแล้ว',
        downloadFailedTitle: 'ดาวน์โหลดไม่สำเร็จ',
        templateDownloaded: 'ดาวน์โหลดเทมเพลตเงินเดือนแล้ว',
        templateDownloadFailed: 'ดาวน์โหลดเทมเพลตเงินเดือนไม่สำเร็จ',

        checkFormTitle: 'ตรวจฟอร์ม',

        previewReadyTitle: 'พรีวิวพร้อมแล้ว',
        previewReady: 'คำนวณพรีวิวการจ่ายเงินสำเร็จ',
        previewFailedTitle: 'พรีวิวไม่สำเร็จ',
        previewFailed: 'คำนวณพรีวิวการจ่ายเงินไม่สำเร็จ',

        previewRequiredTitle: 'จำเป็นต้องพรีวิว',
        previewRequired:
          'โปรดพรีวิวการจ่ายเงินก่อนสร้าง Excel',

        generatedTitle: 'สร้างแล้ว',
        generated: 'สร้าง Excel การจ่ายเงินสำเร็จ',
        generateFailedTitle: 'สร้างไฟล์ไม่สำเร็จ',
        generateFailed: 'สร้าง Excel การจ่ายเงินไม่สำเร็จ',
      },

      salary: {
        fileRequired: 'จำเป็นต้องมีไฟล์ Excel เงินเดือน',
        fileInvalid: 'ไฟล์ Excel เงินเดือนว่างหรือไม่ถูกต้อง',
        unableToRead: 'ไม่สามารถอ่านไฟล์ Excel เงินเดือนได้',
        noSheet: 'Excel เงินเดือนไม่มีชีต',
        missingEmployeeId: 'ไม่มี ID พนักงาน',
        invalidSalary: 'เงินเดือนไม่ถูกต้อง',
        duplicateEmployeeId: 'ID พนักงานซ้ำใน Excel เงินเดือน',
        salaryNotFound: 'ไม่พบเงินเดือนใน Excel เงินเดือนที่อัปโหลด',
      },

      issue: {
        invalidSalaryRow: 'แถวเงินเดือนไม่ถูกต้อง',
        duplicateSalaryRow: 'แถวเงินเดือนซ้ำ',
        missingSalary: 'เงินเดือนขาดหาย',
        noPayableMinutes: 'ไม่มีนาทีที่จ่ายได้จากการเข้างาน/นโยบาย',
        attendanceVerificationNotSaved: 'ยังไม่ได้บันทึกการตรวจสอบการเข้างาน',
        noAttendancePolicyPayable:
          'ไม่พบนาทีที่จ่ายได้จากการเข้างาน/นโยบาย',
        payableWarning:
          'คำนวณนาทีที่จ่ายได้แล้ว แต่ผลการตรวจสอบไม่ใช่ MATCH แบบตรงทั้งหมด',
      },
    },
  },
}
