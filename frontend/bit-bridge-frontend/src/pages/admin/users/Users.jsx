import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getUsers } from '../../../redux/actions/user'
import Loading from '../../../components/loader/Loading'
import dateFormater from '../../../utils/dateFormat'
import { NavLink } from 'react-router-dom'
import { SearchOutlined, UserOutlined } from '@ant-design/icons'

const Users = () => {
  const dispatch = useDispatch()
  const { users, loading } = useSelector((state) => state.user)
  const [search, setSearch] = useState('')

  useEffect(() => {
    dispatch(getUsers())
  }, [dispatch])

  const filteredUsers = (users || []).filter((item) => {
    const q = search.trim().toLowerCase()
    if (!q) return true

    const email = (item.email || '').toLowerCase()
    const role = (item.role || '').toLowerCase()
    const firstName = (item.user_profile?.first_name || '').toLowerCase()
    const lastName = (item.user_profile?.last_name || '').toLowerCase()
    const phone = (item.user_profile?.phone_number || '').toLowerCase()

    return (
      email.includes(q) ||
      role.includes(q) ||
      firstName.includes(q) ||
      lastName.includes(q) ||
      phone.includes(q)
    )
  })

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 overflow-y-auto">
      {/* Header + search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h3 className="font-semibold text-2xl flex items-center gap-2">
            <UserOutlined className="text-sky-400" />
            <span>Users</span>
          </h3>
          <p className="text-slate-400 mt-1">
            View and manage all registered BitBridge users.
          </p>
        </div>

        <div className="w-full md:w-72">
          <div className="relative">
            <SearchOutlined className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email, name, phone, role..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Users table card */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-lg font-semibold">User List</h4>
          <span className="text-xs text-slate-400">
            {filteredUsers.length} user(s) found
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 px-3">Email</th>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3 hidden md:table-cell">Registered</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center">
                    <Loading />
                  </td>
                </tr>
              ) : filteredUsers.length < 1 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">
                    No users found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item) => (
                  <tr
                    key={item?.id}
                    className="border-b border-slate-800 hover:bg-slate-950/60"
                  >
                    <td className="whitespace-nowrap py-2 px-3">
                      <p className="font-medium text-slate-200 leading-5">
                        {item.email}
                      </p>
                    </td>

                    <td
                      className={`whitespace-nowrap py-2 px-3 font-semibold ${
                        item?.role === 'admin' ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {item?.role}
                    </td>

                    <td className="whitespace-nowrap py-2 px-3 text-slate-300 hidden md:table-cell">
                      {dateFormater(item?.created_at)}
                    </td>

                    <td className="whitespace-nowrap py-2 px-3 text-right">
                      <NavLink
                        to={`/admin/users/${item.id}`}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs text-white transition-colors"
                      >
                        View
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

export default Users
