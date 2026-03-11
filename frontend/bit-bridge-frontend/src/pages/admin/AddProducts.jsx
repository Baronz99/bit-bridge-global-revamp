import { Button, Form, Switch } from 'antd'
import FormInput from '../../components/formInput/FormInput'
import FormSelect from '../../components/formSelect/FormSelect'
import FormInputArea from '../../components/formInputArea/FormInput'
import { useDispatch } from 'react-redux'
import { createProduct } from '../../redux/actions/product'
import { createProvision } from '../../redux/actions/provision'
import { toast } from 'react-toastify'
import './AddProducts.scss'

// const normFile = (e) => {
//   if (Array.isArray(e)) {
//     return e;
//   }
//   return e?.fileList;
// };

const SERVICE_TYPE_ALIASES = {
  CABLE: 'TV',
  POWER: 'ELECTRICITY',
}

const normalizeServiceType = (value) => {
  const normalized = String(value || '').trim().toUpperCase()
  return SERVICE_TYPE_ALIASES[normalized] || normalized || undefined
}

const parseAmount = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : NaN
}

const validateRange = (minValue, maxValue, label) => {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    throw new Error(`${label} values must be numeric`)
  }

  if (minValue < 0 || maxValue < 0) {
    throw new Error(`${label} values cannot be negative`)
  }

  if (minValue > maxValue) {
    throw new Error(`${label} minimum cannot be greater than maximum`)
  }
}

const AddProduct = () => {
  const [form] = Form.useForm()
  const dispatch = useDispatch()
  const createBothProvisions = Form.useWatch('create_both_provisions', form)

  const categoryDefaults = {
    utility: { currency: 'ngn', service_type: 'UTILITY' },
    'mobile provider': { currency: 'ngn', service_type: 'VTU' },
    service: { currency: 'ngn' },
    'gift card': { currency: 'usd' },
    crypto: { currency: 'usd' },
  }

  const handleCategoryChange = (value) => {
    const defaults = categoryDefaults[value]

    if (!defaults) return

    const nextValues = {}

    if (defaults.currency) {
      nextValues.currency = defaults.currency
    }

    if (typeof defaults.service_type !== 'undefined') {
      nextValues.service_type = defaults.service_type
    }

    if (value === 'mobile provider') {
      nextValues.create_both_provisions = true
    }

    form.setFieldsValue(nextValues)
  }

  return (
    <>
      <div className="admin-add-product">
        <div className="admin-add-product__shell">
          <div className="admin-add-product__header">
            <div>
              <p className="admin-add-product__eyebrow">Admin</p>
              <h1>Add product</h1>
              <p className="admin-add-product__subtext">
                Create a product and its provision in one step.
              </p>
            </div>
          </div>
        <Form
          onFinish={async (values) => {
            try {
              const productPayload = {
                provider: values.provider,
                category: values.category,
                header_info: values.header_info,
                description: values.description,
                info: values.info,
                attention: values.attention,
                notice_info: values.notice_info,
                image: values.image,
                currency: values.currency,
                rate: values.rate,
              }

              const productResult = await dispatch(createProduct(productPayload)).unwrap()
              const productId = productResult?.data?.id

              if (!productId) {
                toast('Product created but no ID returned', { type: 'error' })
                return
              }

              const isMobileProvider = values.category === 'mobile provider'
              const createBoth = isMobileProvider && values.create_both_provisions

              if (createBoth) {
                const vtuMin = parseAmount(values.vtu_min_value)
                const vtuMax = parseAmount(values.vtu_max_value)
                const dataMin = parseAmount(values.data_min_value)
                const dataMax = parseAmount(values.data_max_value)

                validateRange(vtuMin, vtuMax, 'VTU')
                validateRange(dataMin, dataMax, 'DATA')

                const provisionPayloads = [
                  {
                    name: 'Airtime',
                    currency: values.currency,
                    min_value: vtuMin,
                    max_value: vtuMax,
                    value_range: [vtuMin, vtuMax],
                    provision_value_type: values.provision_value_type,
                    service_type: 'VTU',
                    description: values.provision_description || values.description,
                    notice: values.notice || values.notice_info,
                    product_id: productId,
                  },
                  {
                    name: 'Data',
                    currency: values.currency,
                    min_value: dataMin,
                    max_value: dataMax,
                    value_range: [dataMin, dataMax],
                    provision_value_type: values.provision_value_type,
                    service_type: 'DATA',
                    description: values.provision_description || values.description,
                    notice: values.notice || values.notice_info,
                    product_id: productId,
                  },
                ]

                await Promise.all(
                  provisionPayloads.map((payload) =>
                    dispatch(createProvision(payload)).unwrap()
                  )
                )
              } else {
                const minValue = parseAmount(values.min_value)
                const maxValue = parseAmount(values.max_value)

                validateRange(minValue, maxValue, 'Provision')

                const provisionPayload = {
                  name: values.provision_name,
                  currency: values.currency,
                  min_value: minValue,
                  max_value: maxValue,
                  value_range: [minValue, maxValue],
                  provision_value_type: values.provision_value_type,
                  service_type: normalizeServiceType(values.service_type),
                  description: values.provision_description || values.description,
                  notice: values.notice || values.notice_info,
                  product_id: productId,
                }

                await dispatch(createProvision(provisionPayload)).unwrap()
              }

              form.resetFields()
              toast('Product and provision created', { type: 'success' })
            } catch (error) {
              toast(error?.message ?? 'Unable to create product', { type: 'error' })
            }
          }}
          initialValues={{
            provider: '',
            currency: 'usd',
            provision_name: '',
            provision_value_type: 'range',
            min_value: 0,
            max_value: 50000,
            vtu_min_value: 50,
            vtu_max_value: 50000,
            data_min_value: 50,
            data_max_value: 150000,
            service_type: '',
            rate: 1,
            image: '',
            description: '',
            info: '',
            attention: '',
            notice_info: '',
            header_info: '',
            category: 'gift card',
            create_both_provisions: false,
          }}
          layout="vertical"
          className="admin-add-product__form"
        >
          <section className="admin-add-product__section">
            <div className="admin-add-product__section-title">
              <h2>Product basics</h2>
              <p>Provider, category, and naming.</p>
            </div>

            <FormSelect
              label={'Category'}
              name={'category'}
              onChange={handleCategoryChange}
              options={[
                { label: 'service', value: 'service' },
                { value: 'gift card', label: 'Gift Card' },
                { value: 'mobile provider', label: 'Mobile Service' },
                { value: 'utility', label: 'Utility' },
                { value: 'crypto', label: 'Crypto' },
              ]}
              className="admin-dark-select"
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                placeholder={'Provider'}
                name={'provider'}
                label={'Provider'}
                required={true}
                className={'admin-dark-input w-full'}
              />
              <FormInput
                placeholder={'Provision name (single)'}
                name={'provision_name'}
                label={'Provision name (single)'}
                required={!createBothProvisions}
                className={'admin-dark-input w-full'}
              />
            </div>
          </section>

          <section className="admin-add-product__section">
            <div className="admin-add-product__section-title">
              <h2>Provision details</h2>
              <p>Currency, value range, and service type.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormSelect
                label={'Currency'}
                name={'currency'}
                options={[
                  { label: 'USD', value: 'usd' },
                  { label: 'NGN', value: 'ngn' },
                  { label: 'GBP', value: 'gbp' },
                  { label: 'EUR', value: 'eur' },
                ]}
                className="admin-dark-select"
              />
              <FormSelect
                label={'Provision value type'}
                name={'provision_value_type'}
                options={[
                  { label: 'Range', value: 'range' },
                  { label: 'Fixed', value: 'fixed' },
                ]}
                className="admin-dark-select"
              />
              {!createBothProvisions && (
                <FormSelect
                  label={'Service type (optional)'}
                  name={'service_type'}
                  options={[
                    { label: 'VTU', value: 'VTU' },
                    { label: 'DATA', value: 'DATA' },
                    { label: 'TV', value: 'TV' },
                    { label: 'ELECTRICITY', value: 'ELECTRICITY' },
                    { label: 'UTILITY', value: 'UTILITY' },
                  ]}
                  className="admin-dark-select"
                />
              )}
            </div>

            <div className="flex items-center justify-between gap-4 py-2">
              <div className="text-sm text-slate-300">
                Create both VTU + DATA provisions (mobile providers)
              </div>
              <Form.Item
                name="create_both_provisions"
                valuePropName="checked"
                className="mb-0"
              >
                <Switch />
              </Form.Item>
            </div>

            {createBothProvisions ? (
              <div className="grid gap-4 md:grid-cols-2">
                <FormInput
                  placeholder={'VTU min value'}
                  name={'vtu_min_value'}
                  label={'VTU min value'}
                  required={true}
                  type="number"
                  className={'admin-dark-input'}
                />
                <FormInput
                  placeholder={'VTU max value'}
                  name={'vtu_max_value'}
                  label={'VTU max value'}
                  required={true}
                  type="number"
                  className={'admin-dark-input'}
                />
                <FormInput
                  placeholder={'DATA min value'}
                  name={'data_min_value'}
                  label={'DATA min value'}
                  required={true}
                  type="number"
                  className={'admin-dark-input'}
                />
                <FormInput
                  placeholder={'DATA max value'}
                  name={'data_max_value'}
                  label={'DATA max value'}
                  required={true}
                  type="number"
                  className={'admin-dark-input'}
                />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <FormInput
                  placeholder={'Min value'}
                  name={'min_value'}
                  label={'Min value'}
                  required={true}
                  type="number"
                  className={'admin-dark-input'}
                />
                <FormInput
                  placeholder={'Max value'}
                  name={'max_value'}
                  label={'Max value'}
                  required={true}
                  type="number"
                  className={'admin-dark-input'}
                />
              </div>
            )}
          </section>

          <section className="admin-add-product__section">
            <div className="admin-add-product__section-title">
              <h2>Display copy (optional)</h2>
              <p>What users will see on the dashboard.</p>
            </div>

            <FormInputArea
              placeholder={'Header info (optional)'}
              name={'header_info'}
              label={'Header info'}
              required={false}
              className={'admin-dark-input'}
            />

            <FormInputArea
              placeholder={'Description (optional)'}
              name={'description'}
              label={'Description'}
              required={false}
              className={'admin-dark-input'}
            />
            <FormInputArea
              placeholder={'Info (optional)'}
              name={'info'}
              label={'Info'}
              required={false}
              className={'admin-dark-input'}
            />
            <FormInputArea
              placeholder={'Attention (optional)'}
              name={'attention'}
              label={'Attention'}
              required={false}
              className={'admin-dark-input'}
            />

            <FormInputArea
              placeholder={'Notice info (optional)'}
              name={'notice_info'}
              label={'Notice info'}
              required={false}
              className={'admin-dark-input'}
            />

            <Form.Item name={'Submit'}>
              <Button
                htmlType="submit"
                className="admin-add-product__submit"
              >
                Create product
              </Button>
            </Form.Item>
          </section>
        </Form>
      </div>
      </div>
    </>
  )
}
export default AddProduct
