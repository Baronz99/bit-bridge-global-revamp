import React from 'react'
import PropTypes from 'prop-types'
import { Form } from 'antd'
import FormInput from '../formInput/FormInput'
import ClassicBtn from '../button/ClassicButton'

const BasicDetailsForm = ({ initialValues, onSubmit, loading }) => {
  const [form] = Form.useForm()

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={onSubmit}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="First name"
          name="first_name"
          required
          type="text"
          placeholder="Ada"
        />
        <FormInput
          label="Last name"
          name="last_name"
          required
          type="text"
          placeholder="Okafor"
        />
      </div>

      <FormInput
        label="Phone number"
        name="phone_number"
        required
        type="tel"
        placeholder="080..."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="State"
          name="state"
          type="text"
          placeholder="Lagos"
        />
        <FormInput
          label="City"
          name="city"
          type="text"
          placeholder="Lekki"
        />
      </div>

      <p className="text-[11px] text-slate-400 mt-3">
        We use this information to keep your account secure and comply with
        CBN/AML/KYC guidelines. You can always update these details later
        from your profile.
      </p>

      <Form.Item className="mt-5 mb-0">
        <ClassicBtn
          htmlType="submit"
          isLoading={loading}
          className="w-full h-11 rounded-xl shadow-md !my-0"
        >
          Continue
        </ClassicBtn>
      </Form.Item>
    </Form>
  )
}

BasicDetailsForm.propTypes = {
  initialValues: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
  loading: PropTypes.bool,
}

export default BasicDetailsForm
