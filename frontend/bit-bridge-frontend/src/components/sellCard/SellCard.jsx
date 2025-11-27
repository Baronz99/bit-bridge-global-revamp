import { Button, Form } from 'antd'
import { useState } from 'react'
import './style.scss'
import FormSelect from '../formSelect/FormSelect'
import FormInputArea from '../formInputArea/FormInput'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import selectCurrencyOptions from '../../utils/selectCurrencyOption'
const SellGiftCard = ({ handleSubmit, selectedItem }) => {
  const [form] = Form.useForm()
  const [formLayout] = useState('vertical')
  const { loading } = useSelector((state) => state.order)

  // const normFile = (e) => {
  //   if (Array.isArray(e)) {
  //     return e;
  //   }
  //   return e?.fileList;
  // };

  return (
    <Form
      className="sellCard"
      layout={formLayout}
      onFinish={(values) => {
        handleSubmit({
          extra_info: values.extra_info,
          proof: values.proof,
          order_type: values.order_type,
          order_items_attributes: [
            {
              product_id: selectedItem.product_id,
              provision_id: selectedItem.provision_id,
              amount: values.amount,
            },
          ],
        })
      }}
      form={form}
      initialValues={{
        order_type: 'buy',
        amount: '',
        proof: null,
        extra_info: '',
        provision: '',
      }}
      style={{
        color: 'white',
        maxWidth: formLayout === 'inline' ? 'none' : 600,
      }}
    >
      <FormSelect
        required={true}
        disabled
        name="order_type"
        type="number"
        label={'Type'}
        options={[
          { value: 'sell', label: 'Sell' },
          { value: 'buy', label: 'Buy' },
        ]}
      />
      {/* <FormSelect  className="card" onChange={({value}) => setSelectedItem({...selectedItem, provision_id: value})} placeholder="select card" name="provision"  label={"Select card"} options={options}/> */}
      <FormSelect
        className="card"
        placeholder="Amount card"
        name="amount"
        label={'Amount/Value'}
        required={true}
        options={selectCurrencyOptions(selectedItem?.currency)}
      />
      {/* <FormInput required={true} className="ad" name="amount" type='number'  label={"Total amount"} placeHolder="amount" /> */}
      <FormInputArea
        className=""
        name="extra_info"
        label={'Extra Information(optional)'}
        placeHolder=""
      />

      {/* <Form.Item 
        name={"proof"}
        label="payment receipt" 
        valuePropName="fileList" 
        className='text-white add-fund' 
        rules={[
          {
            required: true,
            message: `Please input image receipt!`,
          },
        ]}
        getValueFromEvent={normFile}>
          <Upload 
           beforeUpload={(file)=> {
            const isImage = file.type.startsWith("image/")
            if(!isImage){
              message.error("You can only upload image files!");

            }
            
            return false}
          }          
          maxCount={1}
          name="proof"
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
      <Form.Item label={null}>
        <Button loading={loading} type="primary" htmlType="submit">
          Submit
        </Button>
      </Form.Item>
    </Form>
  )
}

SellGiftCard.propTypes = {
  handleSubmit: PropTypes.func,
  setSelectedItem: PropTypes.func,
  selectedItem: PropTypes.object,
}

export default SellGiftCard
