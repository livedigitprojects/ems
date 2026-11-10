import {Toaster} from "react-hot-toast"
import {Navigate, Route,Routes} from "react-router-dom"
import LoginLanding from "./pages/LoginLanding"
import Dashboard from "./pages/Dashboard"
import Attendance from "./pages/Attendance"
import Employees from "./pages/Employees"
import Leave from "./pages/Leave"
import Payslips from "./pages/Payslips"
import Settings from "./pages/Settings"
import Layout from "./pages/Layout"
import PrintPayslip from "./pages/PrintPayslip"
import LoginForm from "./components/LoginForm"
import MyProfile from "./pages/MyProfile"
import Calendar from "./pages/Calender"
import Announcements from "./pages/Announcements"
import Letters       from "./pages/Letters"    
import AttendanceRegularization from "./pages/AttendanceRegularization"
import EmployeeRegularization   from "./pages/EmployeeRegularization"
import AdminAttendanceCalendar  from "./pages/AdminAttendanceCalendar"
import AttendanceSettings       from "./pages/AttendanceSettings"


const App = () => {
  return (
    <>
      <Toaster/>
      <Routes>
        <Route path="/login" element={<LoginLanding/>}/>
        <Route path="/login/admin" element={<LoginForm role='admin' title="Admin Portal" subtitle="Sign in to manage the organization"/>}/>
        <Route path="/login/employee" element={<LoginForm role='employee' title="Employee Portal" subtitle="Sign in to access your account"/>}/>
        <Route element={<Layout/>}>
            <Route path="/dashboard" element={<Dashboard/>}/>
            <Route path="/employees" element={<Employees/>}/>
            <Route path="/attendance" element={<Attendance/>}/>
            <Route path="/leave" element={<Leave/>}/>
            <Route path="/my-regularization"       element={<EmployeeRegularization />} />
            <Route path="/payslips" element={<Payslips/>}/>
            <Route path="/settings" element={<Settings/>}/>
            <Route path="/my-profile" element={<MyProfile />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/letters"      element={<Letters />} />
            <Route path="/regularization" element={<AttendanceRegularization />} />
            <Route path="/attendance-calendar" element={<AdminAttendanceCalendar />} />
            <Route path="/attendance-settings" element={<AttendanceSettings />} />

        </Route>
        <Route path="/print/payslips/:id" element={<PrintPayslip/>}/>
        <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
      </Routes>
    </>
  )
}

export default App