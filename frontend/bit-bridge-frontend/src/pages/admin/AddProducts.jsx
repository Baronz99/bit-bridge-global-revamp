import { Button, Form } from 'antd'
import FormInput from '../../components/formInput/FormInput'
import FormSelect from '../../components/formSelect/FormSelect'
import FormInputArea from '../../components/formInputArea/FormInput'
import { useDispatch } from 'react-redux'
import { createProduct } from '../../redux/actions/product'
import { toast } from 'react-toastify'

// const normFile = (e) => {
//   if (Array.isArray(e)) {
//     return e;
//   }
//   return e?.fileList;
// };
const AddProduct = () => {
  const [form] = Form.useForm()
  const dispatch = useDispatch()

  return (
    <>
      <div className="max-w-7xl  rounded-lg bg-white p-5">
        <Form
          onFinish={(values) => {
            dispatch(createProduct(values)).then((result) => {
              if (createProduct.fulfilled.match(result)) {
                form.resetFields()
                toast(result.payload.message, { type: 'success' })
              } else if (createProduct.rejected.match(result)) {
                toast(result.payload.message, { type: 'error' })
              }
            })
          }}
          initialValues={{
            provider: '',
            provision: '',
            min_value: 0,
            max_value: 50000.0,
            currency: 'usd',
            rate: 5,
            image: '',
            description: '',
            info: '',
            category: 'gift card',
          }}
          layout="vertical"
        >
          <FormSelect
            label={'Category'}
            name={'category'}
            options={[
              { label: 'service', value: 'service' },
              { value: 'gift card', label: 'Gift Card' },
              { value: 'mobile provider', label: 'Mobile Service' },
              { value: 'utility', label: 'Utility' },
              { value: 'crypto', label: 'Crypto' },
            ]}
          />

          <div className="">
            <div className="flex gap-4">
              <FormInput
                placeholder={'provider'}
                name={'provider'}
                label={'Provider'}
                required={true}
                className={'whiteBg w-full'}
              />
            </div>

            <FormInputArea
              placeholder={'Header Info'}
              name={'header_info'}
              label={'Header Info'}
              required={true}
              className={'flex-1'}
            />

            <FormInputArea
              placeholder={'Enter Description'}
              name={'description'}
              label={'Description'}
              required={true}
            />
            <FormInputArea placeholder={'info'} name={'info'} label={'Info'} required={true} />
            <FormInputArea
              placeholder={'alert info'}
              name={'attention'}
              label={'Attention'}
              required={true}
            />

            <FormInputArea
              placeholder={'Notice info'}
              name={'notice_info'}
              label={'Notice Info'}
              required={true}
            />

            <Form.Item name={'Submit'}>
              <Button htmlType="submit" className="w-full bg-primary text-white font-semibold py-6">
                Submit
              </Button>
            </Form.Item>
          </div>
        </Form>
      </div>
    </>
  )
}
export default AddProduct
