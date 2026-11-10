import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Loading from '../components/Loading';
import PayslipList from '../components/payslip/PayslipList';
import GeneratePayslipForm from '../components/payslip/GeneratePayslipForm';
import PayslipFilters from '../components/payslip/PayslipFilters';
import { defaultPayslipFilter, resolvePayslipFilter } from '../components/payslip/payslipFilter';
import { useAuth } from '../context/authContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

const Payslips = () => {
  const [payslips,setPayslips]= useState([]);
  const [employees,setEmployees] = useState([]);
  const [loading,setLoading] = useState(true)
  const [refreshing,setRefreshing] = useState(false)
  const [exporting,setExporting] = useState(false)
  const [filter,setFilter] = useState(defaultPayslipFilter)

  const {user} = useAuth()
  const isAdmin= user?.role === "ADMIN"

  // Filter state -> API params (admin only; employees always see their own full history)
  const { params, error: filterError, label: periodLabel } = useMemo(
    () => (isAdmin ? resolvePayslipFilter(filter) : { params: {}, label: "All periods" }),
    [filter, isAdmin]
  )

  const requestId = useRef(0)   // ignore out-of-order responses while the filter changes quickly

  const fetchPayslips = useCallback(async()=>{
    if (filterError) return
    const id = ++requestId.current
    setRefreshing(true)
    try {
      const res = await api.get("/payslips", { params })
      if (id !== requestId.current) return
      setPayslips(res.data.data || [])
    } catch (error) {
      if (id === requestId.current) toast.error(error?.response?.data?.error || error?.message)
    }finally{
      if (id === requestId.current) { setLoading(false); setRefreshing(false) }
    }
  },[params, filterError])

  useEffect(()=>{
    fetchPayslips()
  },[fetchPayslips])

  useEffect(()=>{
    if(isAdmin){
      api.get("/employees").then((res)=> setEmployees(res.data.filter((e)=> !e.isDeleted))).catch(()=>{})
    }
  },[isAdmin])

  const handleExport = async () => {
    if (filterError || exporting) return
    setExporting(true)
    try {
      // Same params as the list above, so the file holds exactly the records on screen.
      const res = await api.get("/payslips/export", { params, responseType: "blob" })
      const slug = params.from ? (params.from === params.to ? params.from : `${params.from}_to_${params.to}`) : "all"
      const url  = URL.createObjectURL(res.data)
      const a    = document.createElement("a")
      a.href = url
      a.download = `payslips_${slug}.xlsx`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      toast.success("Excel file downloaded")
    } catch (error) {
      let msg = error?.response?.data?.error
      if (error?.response?.data instanceof Blob) {
        try { msg = JSON.parse(await error.response.data.text()).error } catch { /* not JSON */ }
      }
      toast.error(msg || "Failed to export payslips")
    } finally {
      setExporting(false)
    }
  }

  if(loading) return <Loading/>
  return (
    <div className='animate-fade-in lg:h-full lg:flex lg:flex-col lg:min-h-0'>
      <div className='shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6'>
        <div><h1 className='text-3xl text-slate-100'>Payslips</h1><p className='page-subtitle'>{isAdmin ? "Generate and manage employee payslips":"Your payslip history"}</p></div>
        {isAdmin && <GeneratePayslipForm employees={employees} onSuccess={fetchPayslips}/>}
      </div>

      {isAdmin && (
        <PayslipFilters
          filter={filter}
          onChange={setFilter}
          error={filterError}
          periodLabel={periodLabel}
          count={payslips.length}
          exporting={exporting}
          onExport={handleExport}
        />
      )}

      <PayslipList
        payslips={payslips}
        isAdmin={isAdmin}
        onRefresh={fetchPayslips}
        refreshing={refreshing}
        className='lg:flex-1 lg:min-h-[16rem]'
      />
    </div>
  )
}

export default Payslips