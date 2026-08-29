import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

// Mock types - update with actual DB types
type UserRole = "USER" | "WELFARE_OFFICER" | "MEDICAL_STAFF" | "ADMIN" | "SUPER_ADMIN";
type UserStatus = "ACTIVE" | "SUSPENDED" | "LOCKED";

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  unit: string;
  serviceNumber: string;
  status: UserStatus;
  lastLogin?: string;
}

const mockUsers: User[] = [
  { id: "1", email: "admin@mw.local", name: "Admin User", role: "SUPER_ADMIN", unit: "HQ", serviceNumber: "A001", status: "ACTIVE" },
  { id: "2", email: "welfare@mw.local", name: "Welfare Officer", role: "WELFARE_OFFICER", unit: "UNIT-1", serviceNumber: "W001", status: "ACTIVE" },
  { id: "3", email: "user1@mw.local", name: "John Doe", role: "USER", unit: "UNIT-1", serviceNumber: "U001", status: "SUSPENDED" },
];

const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(["USER", "WELFARE_OFFICER", "MEDICAL_STAFF", "ADMIN", "SUPER_ADMIN"]),
  unit: z.string().min(2),
  serviceNumber: z.string().min(2),
});

export function AdminUserManagementView() {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      email: "",
      name: "",
      role: "USER",
      unit: "",
      serviceNumber: "",
    },
  });

  const onSubmitCreate = (values: z.infer<typeof userSchema>) => {
    // Generate temp password in reality this would be done on the backend
    const newUser: User = {
      id: Math.random().toString(),
      ...values,
      status: "ACTIVE",
    };
    setUsers([...users, newUser]);
    setIsCreateOpen(false);
    form.reset();
    toast({ title: "User created", description: "Temporary password has been generated." });
  };

  const handleStatusChange = (id: string, newStatus: UserStatus) => {
    setUsers(users.map(u => u.id === id ? { ...u, status: newStatus } : u));
    toast({ title: "Status updated", description: `User status changed to ${newStatus}` });
  };

  const handleRoleChange = (id: string, newRole: UserRole) => {
    setUsers(users.map(u => u.id === id ? { ...u, role: newRole } : u));
    toast({ title: "Role updated", description: `User role changed to ${newRole}` });
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(search.toLowerCase()) || 
                          user.serviceNumber.toLowerCase().includes(search.toLowerCase()) ||
                          user.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">Manage platform access, roles, and status for all personnel.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Bulk Import</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Import Users</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Upload a CSV file with columns: email, name, unit, service_number, role</p>
                <Input type="file" accept=".csv" />
                <Button className="w-full" onClick={() => { setIsBulkOpen(false); toast({ title: "Import scheduled", description: "Users are being imported in the background." }); }}>Upload CSV</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>Create User</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-4">
                  <FormField control={form.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="serviceNumber" render={({ field }) => (
                    <FormItem><FormLabel>Service Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="unit" render={({ field }) => (
                    <FormItem><FormLabel>Unit / Department</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="USER">User</SelectItem>
                          <SelectItem value="WELFARE_OFFICER">Welfare Officer</SelectItem>
                          <SelectItem value="MEDICAL_STAFF">Medical Staff</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <DialogFooter>
                    <Button type="submit">Create User</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-4 items-center">
            <Input 
              placeholder="Search by name, service number, or email..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                <SelectItem value="USER">Users</SelectItem>
                <SelectItem value="WELFARE_OFFICER">Welfare Officers</SelectItem>
                <SelectItem value="ADMIN">Admins</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.serviceNumber}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span>{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={user.role} onValueChange={(val: UserRole) => handleRoleChange(user.id, val)}>
                      <SelectTrigger className="h-8 w-[140px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">User</SelectItem>
                        <SelectItem value="WELFARE_OFFICER">Welfare Officer</SelectItem>
                        <SelectItem value="MEDICAL_STAFF">Medical Staff</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{user.unit}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === "ACTIVE" ? "default" : "destructive"}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {user.status === "ACTIVE" ? (
                        <Button variant="outline" size="sm" onClick={() => handleStatusChange(user.id, "SUSPENDED")}>Suspend</Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => handleStatusChange(user.id, "ACTIVE")}>Activate</Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => {
                        toast({ title: "Password Reset", description: `Reset link sent to ${user.email}` });
                      }}>Reset Pass</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default AdminUserManagementView;
