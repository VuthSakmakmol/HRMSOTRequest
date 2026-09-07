function s(value) {
  return String(value ?? '').trim()
}

function upper(value) {
  return s(value).toUpperCase()
}

function buildMatcher(settings = {}) {
  const positions = Array.isArray(settings.separatePositions) ? settings.separatePositions : []
  const ids = new Set(positions.map((item) => s(item.id || item._id)).filter(Boolean))
  const codes = new Set(positions.map((item) => upper(item.code)).filter(Boolean))
  const names = new Set(positions.map((item) => upper(item.name)).filter(Boolean))

  return {
    hasConfiguration: positions.length > 0,
    matches(row = {}) {
      const id = s(row.positionId)
      const code = upper(row.positionCode)
      const name = upper(row.positionName)

      if (id && ids.has(id)) return true
      if (code && codes.has(code)) return true
      if (name && names.has(name)) return true

      return false
    },
  }
}

function splitPaymentPreviewData(data = {}, settings = {}) {
  const matcher = buildMatcher(settings)

  if (!matcher.hasConfiguration) {
    return {
      enabled: false,
      selectedPositions: [],
      main: data,
      separate: null,
      counts: {
        mainItems: Array.isArray(data.items) ? data.items.length : 0,
        separateItems: 0,
      },
    }
  }

  const items = Array.isArray(data.items) ? data.items : []
  const auditRows = Array.isArray(data.auditRows) ? data.auditRows : []

  const mainItems = items.filter((item) => !matcher.matches(item))
  const separateItems = items.filter((item) => matcher.matches(item))
  const mainAuditRows = auditRows.filter((item) => !matcher.matches(item))
  const separateAuditRows = auditRows.filter((item) => matcher.matches(item))

  const selectedPositions = Array.isArray(settings.separatePositions)
    ? settings.separatePositions
    : []

  const splitMeta = {
    enabled: true,
    selectedPositions,
  }

  return {
    enabled: true,
    selectedPositions,
    main: {
      ...data,
      items: mainItems,
      auditRows: mainAuditRows,
      reportSplit: {
        ...splitMeta,
        type: 'MAIN',
      },
    },
    separate: {
      ...data,
      items: separateItems,
      auditRows: separateAuditRows,
      reportSplit: {
        ...splitMeta,
        type: 'SEPARATE_POSITIONS',
      },
    },
    counts: {
      mainItems: mainItems.length,
      separateItems: separateItems.length,
      mainAuditRows: mainAuditRows.length,
      separateAuditRows: separateAuditRows.length,
    },
  }
}

module.exports = {
  splitPaymentPreviewData,
}
