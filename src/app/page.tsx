"use client";

import React, { useState, useEffect } from "react";
import { Button, Checkbox, DatePicker, DatePickerProps, Form, FormProps, Input, Modal, Progress, ProgressProps, Tag } from "antd";
import { PlusOutlined, PushpinOutlined, SearchOutlined, TagOutlined } from "@ant-design/icons";
import '@/styles/home.css'

const Home = () => {
  const [searchkey, setSearchkey] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const twoColors: ProgressProps['strokeColor'] = {
    '0%': '#108ee9',
    '100%': '#87d068',
  };

  type FieldType = {
    name?: string;
    expirationDate?: string;
    lable?: string;
    location?: string;
  };

  const search = (e: React.KeyboardEvent<HTMLInputElement>) => {
    let value = e.currentTarget.value.trim()
    if (value) {
      setSearchkey('')
      console.log(value)
      // window.open(`/search?searchkey=${value}`, '_blank');
    }
  }

  const handleOk = () => {
    form.validateFields()
      .then(() => {
        form.submit()
        form.resetFields();
        setIsModalOpen(false);
      })
    // .catch(() => {
    //   alert(500)
    // })
  };

  const handleCancel = () => {
    form.resetFields();
    setIsModalOpen(false);
  };

  const onFinish: FormProps<FieldType>['onFinish'] = (values) => {
    console.log('Success:', values);
  };

  const onFinishFailed: FormProps<FieldType>['onFinishFailed'] = (errorInfo) => {
    console.log('Failed:', errorInfo);
  };

  const onChange: DatePickerProps['onChange'] = (date, dateString) => {
    console.log(date, dateString);
  };

  // useEffect(() => {
  //   setIsModalOpen(true);
  // }, []);

  return (
    <React.Fragment>
      <div className="header">
        <a className="logo" href="/">
          <img src="/favicon.svg" alt="appLogo" />
          <div className="text">Life Timer</div>
        </a>
        <Button shape="circle" icon={<PlusOutlined />} size="small" onClick={() => setIsModalOpen(true)} />
      </div>
      <div className="main">
        <div>
          <Input placeholder="搜索" value={searchkey} onChange={(e) => setSearchkey(e.target.value)} prefix={<SearchOutlined />} onPressEnter={search} />
        </div>
        <div className="status">
          <div className="status-card warning">
            <div>即将过期</div>
            <div className="text-[#d89614]">1</div>
          </div>
          <div className="status-card danger">
            <div>已过期</div>
            <div className="text-[#dc4446]">3</div>
          </div>
        </div>
        <div className="grid-ul">
          {
            [1, 2, 3, 4, 5, 6].map(p => {
              return (
                <div className="card-li" key={p}>
                  <div className="flex justify-between">
                    <div className="font-[700]">牛奶</div>
                    {
                      p % 2 == 0
                        ?
                        <div className="text-red-700 text-[.14rem]">已过期</div>
                        :
                        <div className="text-[.14rem"><span className="text-[#d89614] pr-[.03rem]">7</span>天</div>
                    }
                  </div>

                  <div className="flex gap-[.1rem] py-[.1rem] flex-wrap">
                    <Tag icon={<TagOutlined />} color="#55acee">
                      生鲜
                    </Tag>
                    <Tag icon={<PushpinOutlined />} color="#3b5999">
                      冰箱
                    </Tag>
                  </div>
                  <div className="flex items-center">
                    <div className="text-[.12rem] w-[1.2rem]">2027-02-14</div>
                    <Progress
                      percent={99.9}
                      strokeColor={twoColors}
                      size="small"
                    />
                  </div>
                </div>
              )
            })
          }
        </div>
      </div>
      <div className="footer"></div>
      <Modal
        title="新增"
        destroyOnHidden={true}
        maskClosable={false}
        open={isModalOpen}
        onOk={handleOk}
        onCancel={handleCancel}
      >
        <Form
          name="basic"
          form={form}
          // labelCol={{ span: 8 }}
          // wrapperCol={{ span: 16 }}
          // style={{ maxWidth: 600 }}
          // initialValues={{ remember: true }}
          // onFinish={onFinish}
          // onFinishFailed={onFinishFailed}
          autoComplete="off"
        >
          <Form.Item<FieldType>
            name="name"
            rules={[{ required: true }]}
            help={false}
          >
            <Input placeholder="物品" />
          </Form.Item>

          <Form.Item<FieldType>
            name="expirationDate"
            rules={[{ required: true }]}
            help={false}
          >
            <DatePicker onChange={onChange} suffixIcon="" styles={{ "root": { "width": "100%" } }} />
          </Form.Item>
          <Form.Item<FieldType>
            name="lable"
            rules={[{ required: true }]}
            help={false}
          >
            <Input placeholder="标签" />
          </Form.Item>
          <Form.Item<FieldType>
            name="location"
            rules={[{ required: true }]}
            help={false}
          >
            <Input placeholder="地点" />
          </Form.Item>
        </Form>
      </Modal>
    </React.Fragment>
  )
};

export default Home;