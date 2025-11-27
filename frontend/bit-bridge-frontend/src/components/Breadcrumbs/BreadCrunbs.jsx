import PropTypes from 'prop-types'
import { useEffect, useRef, useState } from 'react'
import { MdMoreHoriz } from 'react-icons/md'
import { useNavigate } from 'react-router-dom'

const BreadCrunbs = ({ id, setSelectedId, setOpen, link }) => {
  const dropDownRef = useRef(null)
  const [toggle, setToggle] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const closeDropDown = (e) => {
      if (dropDownRef && !dropDownRef.current.contains(e.target)) {
        setToggle(false)
      }
    }

    document.addEventListener('click', closeDropDown)
  }, [])
  return (
    <div className="relative z-[100]" ref={dropDownRef}>
      <span className="cursor-pointer relative z-50" onClick={() => setToggle((prev) => !prev)}>
        <MdMoreHoriz className="text-lg" />

        <div
          style={{ right: 'calc(100% + 10px)' }}
          className={`absolute bottom-0 rounded z-10  p-2 px-4 bg-white ${toggle ? 'block' : 'hidden'}`}
        >
          <ul>
            <li className="my-2">
              <button className="" onClick={() => navigate(link)}>
                View
              </button>
            </li>
            {/* <li className='my-2'>
                <span className=''
                onClick={()=> {
                  setOpen(prev => !prev)
                  setSelectedId(id)
                }}
                >update</span>
              </li> */}
            <li className="my-2">
              <button disabled className="">
                delete
              </button>
            </li>
          </ul>
        </div>
      </span>
    </div>
  )
}

BreadCrunbs.propTypes = {
  id: PropTypes.string,
  setSelectedId: PropTypes.func,
  open: PropTypes.bool,
  setOpen: PropTypes.func,
}

export default BreadCrunbs
