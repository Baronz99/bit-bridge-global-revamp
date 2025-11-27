import React, { useEffect, useState } from 'react'
import { Form, message, Steps, Progress, Button, DatePicker } from 'antd'
import { motion, AnimatePresence } from 'framer-motion'
import './style.scss'
import { useDispatch } from 'react-redux'
import {
  createBankAccount,
  createDepositAccount,
  getAccounts,
  verifyKYC,
} from '../../redux/actions/account'
import { toast } from 'react-toastify'
import FormInput from '../formInput/FormInput'
import ClickButton from '../button/Button'
import AppButton from '../button/Button'
import FormSelect from '../formSelect/FormSelect'
import dayjs from 'dayjs'
import { SET_LOADING } from '../../redux/app'
const { Step } = Steps

const AccountCreationWizard = ({ formData, setFormData, current, setCurrent, setIsAncorModal }) => {
  const [form] = Form.useForm()
  // const [formData, setFormData] = useState({})
  const [accountDetails, setAccountDetails] = useState(null)

  useEffect(() => {
    Object.values(formData).length > 0 && form.setFieldsValue(formData)
  }, [formData, form])

  const dispatch = useDispatch()

  const onboardUser = (values) => {
    dispatch(
      createBankAccount({
        account: { vendor: 'anchor', ...values },
      })
    )
      .unwrap()
      .then((res) => {
        setCurrent((prev) => prev + 1)
        dispatch(getAccounts())
      })
      .catch((err) => {
        toast(err?.message ?? 'failed to initiate action', { type: 'error' })
      })
      .finally(() => {
        dispatch(SET_LOADING(false))
      })
  }

  const verifyKyc = (values) => {
    dispatch(
      verifyKYC({
        account: { vendor: 'anchor', ...values },
      })
    )
      .unwrap()
      .then((res) => {
        setCurrent((prev) => prev + 1)
        dispatch(getAccounts())
      })
      .catch((err) => {
        toast(err?.message ?? 'failed to initiate action', { type: 'error' })
      })
      .finally(() => {
        dispatch(SET_LOADING(false))
      })
  }

  const accountCreation = (values) => {
    dispatch(
      createDepositAccount({
        account: formData,
      })
    )
      .unwrap()
      .then((res) => {
        console.log(res)
        // setAccountDetails(res?.data)
        setCurrent((prev) => prev + 1)
        dispatch(getAccounts())
      })
      .catch((err) => {
        toast(err?.message ?? 'failed to initiate action', { type: 'error' })
      })
      .finally(() => {
        dispatch(SET_LOADING(false))
      })
  }
  const next = async () => {
    dispatch(SET_LOADING(true))
    try {
      const values = await form.validateFields()

      setFormData((prev) => ({ ...prev, ...values }))

      if (current === 0) {
        console.log('first', values)
        onboardUser(values)
        return
      }

      if (current === 1) {
        verifyKyc(values)
        return
      }

      if (current === 2) {
        accountCreation(values)
        return
      }
      //   setCurrent((prev) => prev + 1)
      // form.resetFields()
    } catch (err) {
      console.log('Validation Failed:', err)
    }
  }

  const prev = () => {
    setCurrent((prev) => prev - 1)
  }

  const steps = [
    {
      title: 'Personal Info',
      content: (
        <Form layout="vertical" form={form}>
          <FormInput label="Address" name="address" required placeholder={'Street address'} />

          <FormInput label="City" name="city" placeholder="Enter city" />

          <FormInput label="State" name="state" placeholder="Enter state" />

          <FormInput label="Postal Code" name="postal_code" placeholder="Enter postal code" />
        </Form>
      ),
    },
    {
      title: 'Address & BVN',
      content: (
        <Form layout="vertical" form={form}>
          <FormInput label="BVN" name="bvn" required placeholder="Enter BVN" />
          <FormSelect
            label="Gender"
            name="gender"
            options={[
              { value: 'male', label: 'Male' },
              { value: 'female', label: 'Female' },
            ]}
            placeholder="male / female"
          />

          <Form.Item label="Date of Birth" name="dob">
            <DatePicker
              className="!text-alt bg-transparent hover:bg-transparent border-alt py-3"
              format="YYYY-MM-DD"
              placeholder="Select date"
              style={{ width: '100%' }}
              disabledDate={(current) => current && current.valueOf() > Date.now()} // prevent future dates
            />
          </Form.Item>
        </Form>
      ),
    },
    {
      title: 'Review & Create',
      content: (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold mb-4 text-alt">Review your information</h2>
          <div className="bg-gray- rounded-xl p-4">
            {Object.entries(formData)?.map(([key, val]) => {
              // if it's a Day.js object, format it
              const displayVal = dayjs.isDayjs(val) ? val.format('YYYY-MM-DD') : val || '—'

              return (
                <p key={key} className="text-alt capitalize">
                  <strong>{key.replace('_', ' ')}:</strong> {displayVal}
                </p>
              )
            })}
          </div>
        </div>
      ),
    },

    {
      title: 'Done',
      content: (
        <div
          key="details"
          className="border text-alt rounded-xl p-6 shadow-md text-left max-w-md mx-auto"
        >
          <p className="text-gray-">
            <strong>Account Number:</strong> {accountDetails?.account_number || '—'}
          </p>
          <p className="text-gray-">
            <strong>Bank Name:</strong> {accountDetails?.bank_name || '—'}
          </p>
          <p className="text-gray-">
            <strong>Account ID:</strong> {accountDetails?.account_id || '—'}
          </p>

          <div className="mt-6 text-center">
            <Progress
              percent={100}
              status="active"
              format={() => <span className="text-alt">All Steps Completed</span>}
              strokeColor="#1677ff"
            />
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="max-w-2xl mx-auto bg-gray shadow-xl rounded-2xl p-8 mt-10">
      <Steps current={current} className="mb-8">
        {steps.map((item) => (
          <Step key={item.title} title={item.title} className="!text-white" />
        ))}
      </Steps>

      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -100, opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {steps[current].content}
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-between mt-10 items-center">
        {current > 0 && (
          <AppButton disabled={true} onClick={prev} className=" !text-alt">
            Previous
          </AppButton>
        )}
        {current < steps.length - 1 ? (
          <AppButton className=" !text-alt" onClick={next}>
            Next
          </AppButton>
        ) : (
          <div className="text-center ">
            <AppButton
              type="primary"
              className={'!border-gray-700  !text-white'}
              size="large"
              onClick={() => setIsAncorModal(false)}
            >
              Done
            </AppButton>
          </div>
        )}
      </div>
    </div>
  )
}

export default AccountCreationWizard
