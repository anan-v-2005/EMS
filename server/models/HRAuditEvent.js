import mongoose from 'mongoose';
const schema = new mongoose.Schema({ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true }, employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true }, action: { type: String, required: true, maxlength: 100 }, resourceType: { type: String, required: true, maxlength: 80 }, resourceId: { type: String, default: '' }, reason: { type: String, default: '', maxlength: 1000 }, metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, ip: { type: String, default: '' } }, { timestamps: true });
schema.index({ createdAt: -1 });
export default mongoose.models.HRAuditEvent || mongoose.model('HRAuditEvent', schema);
