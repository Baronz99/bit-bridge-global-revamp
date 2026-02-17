import { useEffect, useMemo, useState } from 'react'
import { Form, Steps, Progress, DatePicker } from 'antd'
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
import AppButton from '../button/Button'
import FormSelect from '../formSelect/FormSelect'
import dayjs from 'dayjs'
import { SET_LOADING } from '../../redux/app'

const { Step } = Steps

const AccountCreationWizard = ({
  formData,
  setFormData,
  current,
  setCurrent,
  setIsAncorModal,
  user,
}) => {
  const [form] = Form.useForm()
  const [accountDetails, setAccountDetails] = useState(null)
  const dispatch = useDispatch()
  const anchorStatus = String(formData?.status || '').toLowerCase()
  const hasExistingAnchorRecord = String(formData?.vendor || '').toLowerCase() === 'anchor'
  const isAnchorKycVerified = ['verified', 'completed'].includes(anchorStatus)
  const requiresProvisionOnly =
    hasExistingAnchorRecord && isAnchorKycVerified && !formData?.account_number

  const prefilledValues = useMemo(() => {
    const profile = user?.user_profile || {}
    return {
      first_name: formData?.first_name || profile?.first_name || '',
      last_name: formData?.last_name || profile?.last_name || '',
      email: formData?.email || user?.email || '',
      phone_number: formData?.phone_number || profile?.phone_number || '',
      address: formData?.address || profile?.address_line1 || '',
      city: formData?.city || profile?.city || '',
      state: formData?.state || profile?.state || '',
      postal_code: formData?.postal_code || profile?.postal_code || '',
      gender: formData?.gender || profile?.gender || undefined,
      dob: formData?.dob
        ? dayjs.isDayjs(formData.dob)
          ? formData.dob
          : dayjs(formData.dob)
        : profile?.date_of_birth
        ? dayjs(profile.date_of_birth)
        : null,
      // Explicit policy: do not prefill BVN from backend/profile.
      bvn: formData?.bvn || '',
    }
  }, [formData, user])

  useEffect(() => {
    form.setFieldsValue(prefilledValues)
  }, [form, prefilledValues])

  useEffect(() => {
    if (requiresProvisionOnly && current > 1) {
      setCurrent(0)
    }
  }, [requiresProvisionOnly, current, setCurrent])

  const runProvisionOnly = async () => {
    const provisionRes = await dispatch(createDepositAccount({ account: { vendor: 'anchor' } })).unwrap()
    const provisionData = provisionRes?.data || provisionRes
    setAccountDetails(provisionData || null)
    setCurrent(1)
    await dispatch(getAccounts())
    toast.success('Account number generated successfully')
  }

  const runCreateFlow = async (values) => {
    const normalizedDob = dayjs.isDayjs(values?.dob) ? values.dob.format('YYYY-MM-DD') : values?.dob
    const payload = {
      vendor: 'anchor',
      first_name: values?.first_name,
      last_name: values?.last_name,
      email: values?.email,
      phone_number: values?.phone_number,
      address: values?.address,
      city: values?.city,
      state: values?.state,
      postal_code: values?.postal_code,
      bvn: values?.bvn,
      dob: normalizedDob,
      gender: values?.gender,
    }

    const hasExistingAnchorRecord =
      String(formData?.vendor || values?.vendor || '').toLowerCase() === 'anchor'

    if (!hasExistingAnchorRecord) {
      try {
        await dispatch(createBankAccount({ account: payload })).unwrap()
      } catch (err) {
        const message = String(err?.message || '').toLowerCase()
        const isAlreadyExists =
          message.includes('already exists') ||
          message.includes('already present') ||
          message.includes('phone number already')
        if (!isAlreadyExists) throw err
      }
    }

    try {
      await dispatch(
        verifyKYC({
          account: {
            vendor: 'anchor',
            bvn: payload.bvn,
            dob: payload.dob,
            gender: payload.gender,
          },
        })
      ).unwrap()
    } catch (err) {
      const msg = String(err?.message || '').toLowerCase()
      const canContinue =
        msg.includes('already completed') ||
        msg.includes('already verified') ||
        msg.includes('already has') ||
        msg.includes('already exists')
      if (!canContinue) throw err
    }

    const provisionRes = await dispatch(createDepositAccount({ account: payload })).unwrap()
    const provisionData = provisionRes?.data || provisionRes

    setAccountDetails(provisionData || null)
    setCurrent(3)
    await dispatch(getAccounts())
    toast.success('Anchor account created successfully')
  }

  const next = async () => {
    dispatch(SET_LOADING(true))
    try {
      if (requiresProvisionOnly) {
        if (current === 0) {
          await runProvisionOnly()
        }
        return
      }

      const stepFields =
        current === 0
          ? ['first_name', 'last_name', 'email', 'phone_number', 'address', 'city', 'state', 'postal_code']
          : current === 1
          ? ['bvn', 'dob', 'gender']
          : []

      const values =
        stepFields.length > 0 ? await form.validateFields(stepFields) : form.getFieldsValue(true)

      const merged = { ...formData, ...form.getFieldsValue(true), ...values }
      setFormData(merged)

      if (current === 0) {
        setCurrent(1)
        return
      }

      if (current === 1) {
        setCurrent(2)
        return
      }

      if (current === 2) {
        await runCreateFlow(merged)
      }
    } catch (err) {
      if (!err?.errorFields) {
        toast(err?.message ?? 'Failed to initiate action', { type: 'error' })
      }
    } finally {
      dispatch(SET_LOADING(false))
    }
  }

  const prev = () => {
    setCurrent((prevStep) => prevStep - 1)
  }

  const standardSteps = [
    {
      title: 'Confirm Details',
      content: (
        <Form
          layout="vertical"
          form={form}
          onValuesChange={(_, allValues) => setFormData((prev) => ({ ...prev, ...allValues }))}
        >
          <FormInput label="First Name" name="first_name" required placeholder="First name" />

          <FormInput label="Last Name" name="last_name" required placeholder="Last name" />

          <FormInput label="Email" name="email" required placeholder="Enter email" />

          <FormInput
            label="Phone Number"
            name="phone_number"
            required
            placeholder="Enter phone number"
          />

          <FormInput label="Address" name="address" required placeholder="Street address" />

          <FormInput label="City" name="city" required placeholder="Enter city" />

          <FormInput label="State" name="state" required placeholder="Enter state" />

          <FormInput label="Postal Code" name="postal_code" required placeholder="Enter postal code" />
        </Form>
      ),
    },
    {
      title: 'Verify Identity',
      content: (
        <Form
          layout="vertical"
          form={form}
          onValuesChange={(_, allValues) => setFormData((prev) => ({ ...prev, ...allValues }))}
        >
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

          <Form.Item
            label="Date of Birth"
            name="dob"
            rules={[{ required: true, message: 'Please select date of birth!' }]}
          >
            <DatePicker
              className="!text-alt bg-transparent hover:bg-transparent border-alt py-3"
              format="YYYY-MM-DD"
              placeholder="Select date"
              style={{ width: '100%' }}
              disabledDate={(candidate) => candidate && candidate.valueOf() > Date.now()}
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
              const displayVal = dayjs.isDayjs(val) ? val.format('YYYY-MM-DD') : val || '--'

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
            <strong>Account Number:</strong> {accountDetails?.account_number || '--'}
          </p>
          <p className="text-gray-">
            <strong>Bank Name:</strong> {accountDetails?.bank_name || '--'}
          </p>
          <p className="text-gray-">
            <strong>Account ID:</strong> {accountDetails?.account_id || accountDetails?.id || '--'}
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

  const provisionOnlySteps = [
    {
      title: 'Provision Account Number',
      content: (
        <div className="space-y-3">
          <div className="bg-gray- rounded-xl p-4 space-y-2">
            <h2 className="text-lg font-semibold text-alt">KYC already verified</h2>
            <p className="text-sm text-gray-300">
              Your Anchor profile is verified. Continue to generate your deposit account number.
            </p>
            <p className="text-alt capitalize">
              <strong>Status:</strong> {formData?.status || '--'}
            </p>
            <p className="text-alt capitalize">
              <strong>Customer ID:</strong> {formData?.useable_id || formData?.account_id || '--'}
            </p>
          </div>
        </div>
      ),
    },
    standardSteps[3],
  ]

  const steps = requiresProvisionOnly ? provisionOnlySteps : standardSteps

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
          <AppButton disabled={current === 3} onClick={prev} className=" !text-alt">
            Previous
          </AppButton>
        )}
        {current < steps.length - 1 ? (
          <AppButton className=" !text-alt" onClick={next}>
            {requiresProvisionOnly && current === 0 ? 'Generate Account Number' : 'Next'}
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
