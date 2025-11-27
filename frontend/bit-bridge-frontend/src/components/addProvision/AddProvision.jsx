import FormInputArea from '../formInputArea/FormInput'
import FormInput from '../formInput/FormInput'
import FormSelect from '../formSelect/FormSelect'
import { Button, Form } from 'antd'
import { useDispatch } from 'react-redux'
import { toast } from 'react-toastify'
import { createProvision } from '../../redux/actions/provision'
import './style.scss'
import PropTypes from 'prop-types'
import { fetchProduct } from '../../redux/actions/product'
// import { PlusOutlined } from '@ant-design/icons'

const AddProvision = ({ productID, setIsOpen }) => {
  const dispatch = useDispatch()
  const [form] = Form.useForm()

  // const normFile = (e) => {

  //   if (Array.isArray(e)) {
  //     return e;
  //   }
  //   return e?.fileList || [];
  // };

  return (
    <div className="provision">
      <Form
        onFinish={(values) => {
          dispatch(
            createProvision({
              provision: {
                product_id: productID,
                ...values,
              },
            })
          ).then((result) => {
            if (createProvision.fulfilled.match(result)) {
              form.resetFields()
              dispatch(fetchProduct(productID))
              toast(result.payload.message ?? 'Provission has been created', { type: 'success' })
              setIsOpen(false)
            } else if (createProvision.rejected.match(result)) {
              toast(result.payload.message, { type: 'error' })
            }
          })
        }}
        initialValues={{
          product_id: 'productID',
          provision: '',
          image: null,
          value: 110,
          currency: 'usd',
          service_type: '',
          description: '',
          value_range: [],
          notice: '',
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
                { value: 'btc', label: 'Bitcoin' },
                { value: 'eth', label: 'Eth' },
                { value: 'doge', label: 'DOGE' },
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
          <div>
            {/* <Form.Item 
        label="payment receipt" 
        valuePropName="fileList" 
        className='text-white add-fund' 
        name="image" 

        getValueFromEvent={normFile}
        >
          <Upload 

          beforeUpload={(file)=> {
            const isImage = file.type.startsWith("image/")
            if(!isImage){
              message.error("You can only upload image files!");

            }
            
            return false}
          }          
          maxCount={1}
    
          listType="picture-card"
          >
            <button
              style={{
                border: 0,
                background: 'none',
              }}
              type="button"
            >
              <PlusOutlined className='text-white' />
              <div
                style={{
                  marginTop: 8,
                  color: "white"
                }}
              >
                Upload
              </div>
            </button>
          </Upload>
        </Form.Item> */}
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
          {/* <div className='flex gap-4'>                    
              
                  <FormInput
                    placeholder={"Min Value"}
                    name={"min_value"}
                    label={"Min value"}
                    required={false}    
                    className={"flex-1"}   
                    type='number'        
                />
                <FormInput
                    placeholder={"Max Value"}
                    name={"max_value"}
                    label={"Max value"}
                    required={false}    
                    className={"flex-1"}   
                    type='number'        
                />
                </div> */}
          {/*         
                <FormInputArea
            placeholder={"Info"}
            name={"info"}
            label={"Info"}
            required={true}       
            
            />    */}
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

AddProvision.propTypes = {
  productID: PropTypes.string,
  setIsOpen: PropTypes.func,
}

export default AddProvision
