import FormInputArea from '../formInputArea/FormInput'
import FormInput from '../formInput/FormInput'
import FormSelect from '../formSelect/FormSelect'
import { Button, Form } from 'antd'
import { useDispatch } from 'react-redux'
import { toast } from 'react-toastify'
import { createProvision, updateProvision } from '../../redux/actions/provision'
import './style.scss'
import PropTypes from 'prop-types'
import { fetchProduct } from '../../redux/actions/product'
import { useEffect } from 'react'
// import { PlusOutlined } from '@ant-design/icons'

const EditProvision = ({ provision, productID, setIsOpen }) => {
  const dispatch = useDispatch()
  const [form] = Form.useForm()

  useEffect(() => {
    form.setFieldsValue({
      ...provision,
    })
  }, [provision, form])

  return (
    <div className="provision">
      <Form
        onFinish={(values) => {
          dispatch(
            updateProvision({
              id: provision.id,
              data: values,
            })
          ).then((result) => {
            if (updateProvision.fulfilled.match(result)) {
              form.resetFields()
              dispatch(fetchProduct(productID))
              toast(result.payload.message ?? 'Provission has been created', { type: 'success' })
              setIsOpen(false)
            } else if (updateProvision.rejected.match(result)) {
              toast(result.payload.message, { type: 'error' })
            }
          })
        }}
        initialValues={{
          name: provision.name,
          currency: provision.currency,
          service_type: provision.service_type,
          description: provision.description,
          value_range: provision.value_range,
          notice: provision.description,
        }}
        layout="vertical"
      >
        <div className="">
          <div className="flex gap-4">
            <FormInput
              placeholder={'name'}
              name={'name'}
              label={'Provision'}
              required={true}
              className={'w-full'}
            />
          </div>
          <div className="flex gap-4">
            <FormSelect
              className={'flex-1'}
              label={'Currency'}
              name={'currency'}
              required={true}
              options={[
                { value: 'ngn', label: 'NGN' },
                { value: 'usd', label: 'USD' },
                { value: 'gbp', label: 'GBP' },
              ]}
            />
            <FormSelect
              placeholder={'Value'}
              name={'service_type'}
              label={'Type'}
              required={false}
              className={'flex-1'}
              options={[
                { value: 'DATA', label: 'DATA' },
                { value: 'ELECTRICITY', label: 'ELECTRICITY' },
                { value: 'VTU', label: 'VTU' },
                { value: 'TV', label: 'TV' },
              ]}
            />
          </div>
          <div className="flex gap-4">
            <FormSelect
              className={'flex-1'}
              label={'value range'}
              name={'value_range'}
              required={false}
              mode="multiple"
              options={[
                { value: '10', label: '10' },
                { value: '20', label: '20' },
                { value: '25', label: '25' },
                { value: '50', label: '50' },
                { value: '75', label: '75' },
              ]}
            />
          </div>
          <FormInputArea
            placeholder={'Notice'}
            name={'notice'}
            label={'Notice'}
            // required={true}
          />{' '}
          <FormInputArea
            placeholder={'description'}
            name={'description'}
            label={'Description'}
            required={true}
          />
          <Form.Item>
            <Button htmlType="submit" className="w-full bg-primary text-white font-semibold py-6">
              Submit
            </Button>
          </Form.Item>
        </div>
      </Form>
    </div>
  )
}

EditProvision.propTypes = {
  provision: PropTypes.object,
  productID: PropTypes.string,
  setIsOpen: PropTypes.func,
}

export default EditProvision
