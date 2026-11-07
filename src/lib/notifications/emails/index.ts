import { renderReceipt } from './receipt'
import { renderOnTheWay } from './on_the_way'
import { renderAtGate } from './at_gate'
import { renderDelivered } from './delivered'
import { renderCancelledRefund } from './cancelled_refund'
import { renderNoShow } from './no_show'
import { renderVendorMissed } from './vendor_missed'
import { renderPayout } from './payout'
import { renderApproved } from './approved'
import { renderAdminAlert } from './admin_alert'
import { renderAdminPaymentIssue } from './admin_payment_issue'
import { renderAdminNewApplication } from './admin_new_application'

type EmailResult = { html: string; text: string }
type Renderer = (payload: Record<string, unknown>) => EmailResult

const renderers: Record<string, Renderer> = {
  receipt:                renderReceipt,
  on_the_way:             renderOnTheWay,
  at_gate:                renderAtGate,
  delivered:              renderDelivered,
  cancelled_refund:       renderCancelledRefund,
  no_show:                renderNoShow,
  vendor_missed:          renderVendorMissed,
  payout:                 renderPayout,
  approved:               renderApproved,
  admin_alert:            renderAdminAlert,
  admin_payment_issue:    renderAdminPaymentIssue,
  admin_new_application:  renderAdminNewApplication,
}

export function renderTemplate(
  template: string,
  payload: Record<string, unknown>,
): EmailResult | null {
  const render = renderers[template]
  if (!render) return null
  return render(payload)
}
