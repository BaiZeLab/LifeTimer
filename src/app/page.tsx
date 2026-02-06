"use client";

import React, { useState, useEffect } from "react";
import { Input } from "antd";
import { CalendarOutlined, ScheduleOutlined, SearchOutlined } from "@ant-design/icons";
import '@/styles/home.css'

const Home = () => {
  const [searchkey, setSearchkey] = useState('')

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
          <div className="card-li">
            <h2>牛奶</h2>
            <span>已过期</span>
            <div>生鲜</div>
            {/* <div>冰箱</div> */}
          </div>
          <div className="card-li">
            <h2>牛奶</h2>
            <span>已过期</span>
            <div>生鲜</div>
            {/* <div>冰箱</div> */}
          </div>
          <div className="card-li">
            <h2>牛奶</h2>
            <span>已过期</span>
            <div>生鲜</div>
            {/* <div>冰箱</div> */}
          </div>
        </div>
      </div>
      <div className="footer"></div>
    </React.Fragment>
  )
};

export default Home;