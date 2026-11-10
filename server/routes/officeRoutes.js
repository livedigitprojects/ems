import { Router } from "express"
import { protect, protectAdmin } from "../middleware/auth.js"
import { getOffices, createOffice, updateOffice, deleteOffice } from "../controllers/officeController.js"

const officeRouter = Router()

officeRouter.get("/",       protect,               getOffices)
officeRouter.post("/",      protect, protectAdmin, createOffice)
officeRouter.put("/:id",    protect, protectAdmin, updateOffice)
officeRouter.delete("/:id", protect, protectAdmin, deleteOffice)

export default officeRouter