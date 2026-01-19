import { MdAddCard, MdOutlineSell } from 'react-icons/md'
import { PiHandWithdraw, PiUsersThreeBold } from 'react-icons/pi'

export const dashboardServices = [
  {
    key: 'airtime',
    label: 'Airtime & Data',
    description: 'Top up MTN, GLO, Airtel and 9mobile.',
    quickLabel: 'Buy airtime / data',
    quickAction: { type: 'navigate', to: '/dashboard/utilities/mobile-top-up' },
    cardAction: { type: 'navigate', to: '/dashboard/utilities/mobile-top-up' },
    card: {
      glowClass: 'bg-sky-500/10',
      iconClass: 'bg-sky-500/15 text-sky-300',
      icon: MdAddCard,
      cta: 'Fast checkout',
    },
    adminAction: {
      label: 'Manage Airtime/Data',
      to: '/admin/products?category=mobile%20provider',
    },
  },
  {
    key: 'electricity',
    label: 'Electricity',
    description: 'Pay PHCN and major DISCOs in seconds.',
    quickLabel: 'Pay electricity',
    quickAction: { type: 'navigate', to: '/dashboard/utilities/buy-power' },
    cardAction: { type: 'navigate', to: '/dashboard/utilities/buy-power' },
    card: {
      glowClass: 'bg-amber-500/10',
      iconClass: 'bg-amber-500/15 text-amber-300',
      icon: PiHandWithdraw,
      cta: 'Meter ready',
    },
    adminAction: {
      label: 'Manage Electricity',
      to: '/admin/products?category=power',
    },
  },
  {
    key: 'cable',
    label: 'Cable TV',
    description: 'Renew DSTV, GOTV and others quickly.',
    quickAction: { type: 'select', value: 'TV Subscription' },
    cardAction: { type: 'navigate', to: '/dashboard/utilities/cable' },
    card: {
      glowClass: 'bg-fuchsia-500/10',
      iconClass: 'bg-fuchsia-500/15 text-fuchsia-300',
      icon: MdOutlineSell,
      cta: 'Smart bundles',
    },
    adminAction: {
      label: 'Manage Cable TV',
      to: '/admin/products?category=utility',
    },
  },
  {
    key: 'virtual-accounts',
    label: 'Virtual accounts',
    description: 'Receive transfers via Anchor or Moniepoint.',
    cardAction: { type: 'navigate', to: '/dashboard/virtual-accounts' },
    card: {
      glowClass: 'bg-emerald-500/10',
      iconClass: 'bg-emerald-500/15 text-emerald-300',
      iconText: 'VA',
      cta: 'Get paid',
    },
  },
  {
    key: 'shared-groups',
    label: 'Shared groups',
    description:
      'Create circles for trips, family bills, and shared savings. Track contributions in one place.',
    cardAction: { type: 'navigate', to: '/dashboard/shared-groups' },
    featured: true,
    card: {
      glowClass: 'bg-blue-500/10',
      iconClass: 'bg-blue-500/15 text-blue-300',
      icon: PiUsersThreeBold,
      cta: 'Start a group',
    },
  },
  {
    key: 'fx-settings',
    label: 'FX settings',
    description: 'Manage Tunnel conversion base rates.',
    adminAction: {
      label: 'Manage FX settings',
      to: '/admin/fx-settings',
    },
  },
]
