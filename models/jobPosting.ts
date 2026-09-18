import mongoose from 'mongoose';

const JobPostingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  department: String,
  location: { type: String, required: true },
  description: { type: String, required: true },
  postedDate: { type: Date, default: Date.now },
  employmentType: { type: String, default: 'Full-time' },
  category: String,
  isActive: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'closed'],
    default: 'draft',
  },
  autoOpenEnabled: { type: Boolean, default: false },
  autoOpenAt: { type: Date, default: null },
  autoOpenCron: { type: String, default: null },
  autoCloseEnabled: { type: Boolean, default: false },
  autoCloseAt: { type: Date, default: null },
  autoCloseCron: { type: String, default: null },
  salary: {
    currency: { type: String, default: 'KES' },
    min: Number,
    max: Number
  },
  requirements: [String],
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'JobQuestion' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const JobPosting = mongoose.models.JobPosting || 
  mongoose.model('JobPosting', JobPostingSchema); 