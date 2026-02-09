"use client";

import React, { useState, useEffect } from "react";
import { Button, Input, Progress, ProgressProps, Tag } from "antd";
import { PlusOutlined, PushpinOutlined, SearchOutlined, TagOutlined } from "@ant-design/icons";
import '@/styles/home.css'

const Home = () => {
  const [searchkey, setSearchkey] = useState('')
  const twoColors: ProgressProps['strokeColor'] = {
    '0%': '#108ee9',
    '100%': '#87d068',
  };

  const search = (e: React.KeyboardEvent<HTMLInputElement>) => {
    let value = e.currentTarget.value.trim()
    if (value) {
      setSearchkey('')
      console.log(value)
      // window.open(`/search?searchkey=${value}`, '_blank');
    }
  }

  return (
    <React.Fragment>
      <div className="header">
        <a className="logo" href="/">
          <img src="/favicon.svg" alt="appLogo" />
          <div className="text">Life Timer</div>
        </a>
        <Button shape="circle" icon={<PlusOutlined />} size="small" />
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
    </React.Fragment>
  )
};

export default Home;