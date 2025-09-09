import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Application } from "@/types/application";
import { motion } from "framer-motion";
import { SelectItemIndicator, SelectItemText } from "@radix-ui/react-select";
import { Card } from "@/components/ui/card";
import { Mail, User, Briefcase, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getNameDisplay, getEmailDisplay, getPositionDisplay, extractDataFromAnswers } from "@/lib";

interface EditApplicationModalProps {
  application: Application | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedApplication: Application) => void;
  jobTitles?: Record<string, string>;
}

export function EditApplicationModal({
  application,
  isOpen,
  onClose,
  onSave,
  jobTitles = {},
}: EditApplicationModalProps) {
  const [editedApplication, setEditedApplication] =
    useState<Application | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");

  // We'll use the application data directly instead of fetching
  // const { data: fullApplication, isLoading } = useQuery<Application>({
  //   queryKey: ['application', application?.id],
  //   queryFn: () => api.get(`/api/admin/applications/${application?.id}`).then(res => res.data),
  //   enabled: !!application?.id && isOpen
  // });

  const statusOptions = [
    { value: "New", color: "bg-blue-100 text-blue-700" },
    { value: "Shortlisted", color: "bg-orange-100 text-orange-700" },
    { value: "Technical Assessment", color: "bg-indigo-100 text-indigo-700" },
    { value: "Interviewing", color: "bg-purple-100 text-purple-700" },
    { value: "Hired", color: "bg-green-100 text-green-700" },
    { value: "Rejected", color: "bg-red-100 text-red-700" },
    { value: "Disqualified", color: "bg-pink-100 text-pink-700" }
  ];

  useEffect(() => {
    if (application && isOpen) {
      // Use the application data directly instead of fetching
      setEditedApplication(application);
      
      // Extract data from different sources (direct fields or answers array)
      const extractedFirstName = extractDataFromAnswers(application.answers || [], 'name', application.user)
        .split(' ')[0] || application.name?.split(' ')[0] || '';
      const extractedLastName = extractDataFromAnswers(application.answers || [], 'name', application.user)
        .split(' ').slice(1).join(' ') || application.name?.split(' ').slice(1).join(' ') || '';
      const extractedEmail = getEmailDisplay(application);
      const extractedPosition = getPositionDisplay(application, jobTitles);
      
      setFirstName(extractedFirstName);
      setLastName(extractedLastName);
      setEmail(extractedEmail);
      setPosition(extractedPosition);
    }
  }, [application, jobTitles, isOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'firstName') {
      setFirstName(value);
      // Update the combined name in the application
      const combinedName = `${value} ${lastName}`.trim();
      setEditedApplication((prev) => prev ? { ...prev, name: combinedName } : null);
    } else if (name === 'lastName') {
      setLastName(value);
      // Update the combined name in the application
      const combinedName = `${firstName} ${value}`.trim();
      setEditedApplication((prev) => prev ? { ...prev, name: combinedName } : null);
    } else if (name === 'email') {
      setEmail(value);
      setEditedApplication((prev) => prev ? { ...prev, email: value } : null);
    } else if (name === 'position') {
      setPosition(value);
      setEditedApplication((prev) => prev ? { ...prev, position: value } : null);
    } else {
      setEditedApplication((prev) => prev ? { ...prev, [name]: value } : null);
    }
  };

  const handleStatusChange = (value: string) => {
    setEditedApplication((prev) => prev ? { ...prev, status: value } : null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedApplication) return;
    onSave(editedApplication);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Edit Application
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[70vh] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="p-6 bg-gradient-to-br from-gray-50 to-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-500" />
                    First Name
                  </label>
                  <Input
                    name="firstName"
                    value={firstName}
                    onChange={handleInputChange}
                    className="bg-white border-gray-200 hover:border-gray-300"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-500" />
                    Last Name
                  </label>
                  <Input
                    name="lastName"
                    value={lastName}
                    onChange={handleInputChange}
                    className="bg-white border-gray-200 hover:border-gray-300"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-green-500" />
                    Email Address
                  </label>
                  <Input
                    name="email"
                    type="email"
                    value={email}
                    onChange={handleInputChange}
                    className="bg-white border-gray-200 hover:border-gray-300"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-purple-500" />
                    Position Applied
                  </label>
                  <Input
                    name="position"
                    value={position}
                    onChange={handleInputChange}
                    className="bg-white border-gray-200 hover:border-gray-300"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Application Status
                  </label>
                  <Select
                    value={editedApplication?.status || ""}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger className="bg-white border-gray-200 hover:border-gray-300">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {statusOptions.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="hover:bg-gray-50 rounded-lg"
                        >
                          <span className={`px-2 py-1 rounded-full text-sm ${option.color}`}>
                            {option.value}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-gray-50 to-white mt-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                Application Answers
              </h3>
              <div className="space-y-4">
                {editedApplication?.answers?.map((answer, index) => (
                  <div key={index} className="space-y-1">
                    <p className="text-sm font-medium text-gray-600">{answer.questionText}</p>
                    <Input
                      value={answer.answer}
                      readOnly
                      className="bg-gray-50 border-gray-200 text-gray-600"
                    />
                  </div>
                ))}
              </div>
            </Card>

            <DialogFooter className="gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-gray-200 hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 shadow-sm"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
