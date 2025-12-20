// src/api/circles.js
import client from './client'

// GET /circles/:id
export const getCircleDetail = (id) => client.get(`/circles/${id}`)

// ✅ backward compatibility
export const getCircle = getCircleDetail

// POST /circles/:id/fund
export const fundCircle = (id, payload) => client.post(`/circles/${id}/fund`, payload)

// POST /circles/:id/withdraw
export const withdrawCircle = (id, payload) =>
  client.post(`/circles/${id}/withdraw`, payload)

// GET /circles/:id/audit_summary
export const getCircleAuditSummary = (id) =>
  client.get(`/circles/${id}/audit_summary`)

// GET /circles/:id/export_csv
export const exportCircleCsv = (id) =>
  client.get(`/circles/${id}/export_csv`, { responseType: 'blob' })

// POST /circles/:id/invite_member
export const inviteCircleMember = (id, payload) =>
  client.post(`/circles/${id}/invite_member`, payload)

// GET /circles/:id/activities
export const listCircleActivities = (id) =>
  client.get(`/circles/${id}/activities`)

// POST /circles/:id/activities
export const createCircleActivity = (id, payload) =>
  client.post(`/circles/${id}/activities`, payload)

// POST /circles/:id/react
export const reactToCircle = (id, payload) =>
  client.post(`/circles/${id}/react`, payload)

// DELETE /circles/:id/react
export const unreactToCircle = (id, payload) =>
  client.delete(`/circles/${id}/react`, { data: payload })

// ✅ backward compatibility aliases
export const reactToCircleTx = reactToCircle
export const unreactToCircleTx = unreactToCircle
