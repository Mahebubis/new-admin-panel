import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Helmet } from "react-helmet-async";

export default function ViewStudent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/api/students/view.php?id=${id}`);
        if (!cancelled && res.data.success) setStudent(res.data.data.student);
      } catch {} finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64"><i className="fas fa-spinner fa-spin mr-2 text-gray-400"></i><span className="text-gray-400">Loading...</span></div>;
  if (!student) return <div className="text-center text-gray-400 py-12">Student not found</div>;

  const Field = ({ label, value }) => (
    <div className="py-2">
      <dt className="text-[10px] font-bold text-gray-400 uppercase">{label}</dt>
      <dd className="text-sm text-gray-800 mt-0.5">{value || '-'}</dd>
    </div>
  );

  return (
    <>
    <Helmet>
        <title>View Students | Admin Panel</title>
      </Helmet>
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-bold text-gray-800">Student Profile — #{student.user_id}</h4>
        <div className="flex gap-2">
          <button onClick={() => navigate(`/students/edit/${id}`)} className="px-4 py-2 text-xs bg-cyan-500 text-white rounded hover:bg-cyan-600 cursor-pointer">Edit</button>
          <button onClick={() => navigate('/students/all')} className="px-4 py-2 text-xs border rounded hover:bg-gray-50 cursor-pointer">Back to List</button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h5 className="text-sm font-bold text-gray-700 mb-3">Personal Details</h5>
          <dl className="grid grid-cols-2 gap-x-4">
            <Field label="Name" value={student.name} />
            <Field label="Email" value={student.email} />
            <Field label="Phone" value={student.phone} />
            <Field label="Gender" value={student.gender} />
            <Field label="City" value={student.city} />
            <Field label="State" value={student.state} />
            <Field label="Country" value={student.country} />
            <Field label="Pincode" value={student.pincode} />
          </dl>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h5 className="text-sm font-bold text-gray-700 mb-3">College Details</h5>
          <dl className="grid grid-cols-2 gap-x-4">
            <Field label="College" value={student.college_name} />
            <Field label="Branch" value={student.branch} />
            <Field label="Program" value={student.program} />
            <Field label="Year" value={student.year} />
          </dl>
          <h5 className="text-sm font-bold text-gray-700 mb-3 mt-4">Account</h5>
          <dl className="grid grid-cols-2 gap-x-4">
            <Field label="Role" value={student.role} />
            <Field label="Active" value={student.active == 1 ? 'Yes' : 'No'} />
            <Field label="Apply For Exam" value={student.applyforexam == 1 ? 'Yes' : 'No'} />
            <Field label="Registered At" value={student.registered_at} />
          </dl>
        </div>
      </div>
    </div>
    </>
  );
}
