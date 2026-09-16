import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { BankOutlined, SearchOutlined } from '@ant-design/icons'
import Loading from '../../../components/loader/Loading'
import { getAdminBusinessEntities } from '../../../api/adminBusiness'
import dateFormater from '../../../utils/dateFormat'

const Businesses = () => {
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [businesses, setBusinesses] = useState([])

  useEffect(() => {
    let active = true

    const loadBusinesses = async () => {
      try {
        setLoading(true)
        setError('')
        const response = await getAdminBusinessEntities()
        if (!active) return
        setBusinesses(Array.isArray(response?.data) ? response.data : [])
      } catch (err) {
        if (!active) return
        setError(err?.response?.data?.message || 'Unable to load business entities.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadBusinesses()

    return () => {
      active = false
    }
  }, [])

  const filteredBusinesses = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return businesses

    return businesses.filter((item) => {
      const name = (item?.name || '').toLowerCase()
      const creator = (item?.creator?.email || '').toLowerCase()
      const status = (item?.status || '').toLowerCase()
      const kybStatus = (item?.kyb?.status || '').toLowerCase()
      return (
        name.includes(query) ||
        creator.includes(query) ||
        status.includes(query) ||
        kybStatus.includes(query)
      )
    })
  }, [businesses, search])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h3 className="font-semibold text-2xl flex items-center gap-2">
            <BankOutlined className="text-sky-400" />
            <span>Businesses</span>
          </h3>
          <p className="text-slate-400 mt-1">
            Review legal entities, KYB status, team access, and business accounts separately from personal users.
          </p>
        </div>

        <div className="w-full md:w-80">
          <div className="relative">
            <SearchOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by business name, creator, status..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-lg font-semibold">Business entities</h4>
          <span className="text-xs text-slate-400">{filteredBusinesses.length} business(es)</span>
        </div>

        {error ? <p className="text-sm text-rose-300 mb-4">{error}</p> : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 px-3">Business</th>
                <th className="py-2 px-3 hidden md:table-cell">Creator</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3 hidden md:table-cell">KYB</th>
                <th className="py-2 px-3 hidden lg:table-cell">Created</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center">
                    <Loading />
                  </td>
                </tr>
              ) : filteredBusinesses.length < 1 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No business entities found.
                  </td>
                </tr>
              ) : (
                filteredBusinesses.map((item) => (
                  <tr key={item?.id} className="border-b border-slate-800 hover:bg-slate-950/60">
                    <td className="py-2 px-3">
                      <p className="font-medium text-slate-200 leading-5">{item?.name || 'Unnamed business'}</p>
                      <p className="text-xs text-slate-500 mt-1">{item?.id}</p>
                    </td>
                    <td className="py-2 px-3 hidden md:table-cell text-slate-300">
                      {item?.creator?.email || 'Not available'}
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs bg-slate-800 border border-slate-700 text-slate-200 capitalize">
                        {item?.status || 'unknown'}
                      </span>
                    </td>
                    <td className="py-2 px-3 hidden md:table-cell text-slate-300 capitalize">
                      {item?.kyb?.status || 'not_started'}
                    </td>
                    <td className="py-2 px-3 hidden lg:table-cell text-slate-300">
                      {dateFormater(item?.created_at)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <NavLink
                        to={`/admin/businesses/${item.id}`}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs text-white transition-colors"
                      >
                        Open
                      </NavLink>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Businesses
