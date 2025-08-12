-- Panoptic Demo Database Schema
-- Create Facilities table
CREATE TABLE Facility (
    Facility_ID VARCHAR(10) PRIMARY KEY,
    Facility_Name VARCHAR(100) NOT NULL,
    Facility_Type VARCHAR(50) NOT NULL,
    Address_Line1 VARCHAR(100) NOT NULL,
    Address_Line2 VARCHAR(100),
    City VARCHAR(50) NOT NULL,
    State VARCHAR(50) NOT NULL,
    Zip_Code VARCHAR(20) NOT NULL,
    Country VARCHAR(50) NOT NULL,
    Phone_Number VARCHAR(20),
    Email VARCHAR(100),
    Square_Footage INT,
    Year_Built INT,
    Ownership_Type VARCHAR(20),
    Production_Capacity_Units_Day INT,
    Warehouse_Capacity_Pallets INT,
    Number_of_Loading_Docks INT,
    Number_of_Production_Lines INT,
    Number_of_Employees INT,
    Operating_Hours VARCHAR(20),
    Maintenance_Schedule VARCHAR(20),
    ISO_Certified VARCHAR(3),
    Last_Audit_Date DATE,
    Energy_Consumption_kWh_Month INT,
    Water_Usage_Gallons_Month INT,
    Waste_Management_Vendor VARCHAR(100),
    Security_Level VARCHAR(20),
    Insurance_Policy_Number VARCHAR(50),
    Property_Tax_ID VARCHAR(50),
    Facility_Manager VARCHAR(100),
    Emergency_Contact VARCHAR(100),
    Latitude DECIMAL(10,7),
    Longitude DECIMAL(10,7)
);

-- Create Supplier table
CREATE TABLE Supplier (
    Supplier_ID VARCHAR(10) PRIMARY KEY,
    Company_Name VARCHAR(100) NOT NULL,
    Material_Category VARCHAR(50) NOT NULL,
    Primary_Material VARCHAR(50) NOT NULL,
    Region VARCHAR(50),
    Country VARCHAR(50) NOT NULL,
    Credit_Rating VARCHAR(10),
    Payment_Terms VARCHAR(20),
    Lead_Time_Days INT,
    Min_Order_Qty VARCHAR(20),
    Quality_Cert VARCHAR(50),
    Tax_ID VARCHAR(20),
    Currency VARCHAR(3),
    Status VARCHAR(20) NOT NULL
);

-- Create Products table
CREATE TABLE Product (
    Product_ID VARCHAR(10) PRIMARY KEY,
    Product_Name VARCHAR(100) NOT NULL,
    Product_Category VARCHAR(50) NOT NULL,
    Description TEXT,
    Base_Price DECIMAL(10,2) NOT NULL,
    Warranty_Period_Months INT,
    Min_Order_Qty INT,
    Lead_Time_Days INT,
    Status VARCHAR(20) NOT NULL
);

-- Create ProductionLines table
CREATE TABLE ProductionLine (
    Line_ID VARCHAR(10) PRIMARY KEY,
    Line_Name VARCHAR(100) NOT NULL,
    Facility_ID VARCHAR(10) NOT NULL,
    Product_Category VARCHAR(50) NOT NULL,
    Primary_Product_ID VARCHAR(10),
    Secondary_Product_ID VARCHAR(10),
    Line_Type VARCHAR(50),
    Installation_Date DATE,
    Max_Capacity_Units_Day INT,
    Current_Efficiency_Percentage DECIMAL(5,2),
    Shift_Pattern VARCHAR(50),
    Line_Manager VARCHAR(100),
    Last_Maintenance_Date DATE,
    Next_Maintenance_Date DATE,
    Downtime_Hours_MTD DECIMAL(10,2),
    OEE_Score DECIMAL(5,2),
    Quality_Rating VARCHAR(5),
    Status VARCHAR(20) NOT NULL,
    FOREIGN KEY (Facility_ID) REFERENCES Facility(Facility_ID),
    FOREIGN KEY (Primary_Product_ID) REFERENCES Product(Product_ID),
    FOREIGN KEY (Secondary_Product_ID) REFERENCES Product(Product_ID)
);

-- Create Machines table
CREATE TABLE Machine (
    Machine_ID VARCHAR(10) PRIMARY KEY,
    Machine_Name VARCHAR(100) NOT NULL,
    Machine_Type VARCHAR(50) NOT NULL,
    Manufacturer VARCHAR(100),
    Model_Number VARCHAR(50),
    Serial_Number VARCHAR(50),
    Installation_Date DATE,
    Last_Maintenance_Date DATE,
    Next_Maintenance_Date DATE,
    Machine_Status VARCHAR(20) NOT NULL,
    Max_Capacity_Units_Hour INT,
    Current_Efficiency_Percentage DECIMAL(5,2),
    Power_Consumption_kWh DECIMAL(10,2),
    Warranty_Expiration_Date DATE,
    Purchase_Cost DECIMAL(12,2),
    Maintenance_Cost_Annual DECIMAL(10,2),
    Expected_Lifespan_Years INT,
    Software_Version VARCHAR(20),
    Control_System_Type VARCHAR(50),
    Product_Category VARCHAR(50)
);

-- Create SupplierKPI table
CREATE TABLE SupplierKPI (
    KPI_ID VARCHAR(10) PRIMARY KEY,
    Supplier_ID VARCHAR(10) NOT NULL,
    Monthly_Order_Fill_Rate_Percentage DECIMAL(5,2),
    Inventory_Turns DECIMAL(5,2),
    Cost_Savings_Initiatives_Percentage DECIMAL(5,2),
    Quality_Incidents_YTD INT,
    Corrective_Actions_Open INT,
    Avg_Resolution_Time_Days DECIMAL(5,2),
    Sustainability_Score INT,
    Development_Projects INT,
    Contract_Compliance_Percentage DECIMAL(5,2),
    Business_Continuity_Score INT,
    FOREIGN KEY (Supplier_ID) REFERENCES Supplier(Supplier_ID)
);

-- Create Parts table
CREATE TABLE Part (
    Part_ID VARCHAR(10) PRIMARY KEY,
    Part_Name VARCHAR(100) NOT NULL,
    Part_Category VARCHAR(50) NOT NULL,
    Product_ID VARCHAR(10) NOT NULL,
    Material_Type VARCHAR(50),
    Supplier_ID VARCHAR(10) NOT NULL,
    Unit_Cost DECIMAL(10,2) NOT NULL,
    Min_Stock_Level INT,
    Lead_Time_Days INT,
    Status VARCHAR(20) NOT NULL,
    FOREIGN KEY (Product_ID) REFERENCES Product(Product_ID),
    FOREIGN KEY (Supplier_ID) REFERENCES Supplier(Supplier_ID)
);

-- Create LineConfiguration table
CREATE TABLE LineConfiguration (
    Config_ID VARCHAR(10) PRIMARY KEY,
    Line_ID VARCHAR(10) NOT NULL,
    Machine_ID VARCHAR(10) NOT NULL,
    Sequence_Number INT NOT NULL,
    Setup_Time_Minutes INT,
    Changeover_Time_Minutes INT,
    Bottleneck_Status VARCHAR(3),
    Last_Calibration_Date DATE,
    Next_Calibration_Date DATE,
    Operator_Skill_Level_Required INT,
    Maintenance_Priority VARCHAR(20),
    FOREIGN KEY (Line_ID) REFERENCES ProductionLine(Line_ID),
    FOREIGN KEY (Machine_ID) REFERENCES Machine(Machine_ID)
);

-- Create ProductionBatch table
CREATE TABLE ProductionBatch (
    Batch_ID VARCHAR(10) PRIMARY KEY,
    Product_ID VARCHAR(10) NOT NULL,
    Line_ID VARCHAR(10) NOT NULL,
    Facility_ID VARCHAR(10) NOT NULL,
    Production_Date DATE NOT NULL,
    Shift VARCHAR(20),
    Quantity_Produced INT NOT NULL,
    Quantity_Rejected INT,
    Start_Time TIME,
    End_Time TIME,
    Cycle_Time_Seconds DECIMAL(10,2),
    Operator_ID VARCHAR(10),
    Quality_Check_Status VARCHAR(20),
    Material_Lot_Number VARCHAR(20),
    Downtime_Minutes INT,
    Energy_Consumption_kWh INT,
    Notes TEXT,
    FOREIGN KEY (Product_ID) REFERENCES Product(Product_ID),
    FOREIGN KEY (Line_ID) REFERENCES ProductionLine(Line_ID),
    FOREIGN KEY (Facility_ID) REFERENCES Facility(Facility_ID)
);

-- Create EBOM (Engineering Bill of Materials) table
CREATE TABLE EBOM (
    EBOM_ID VARCHAR(10) PRIMARY KEY,
    Batch_ID VARCHAR(10) NOT NULL,
    Product_ID VARCHAR(10) NOT NULL,
    Part_ID VARCHAR(10) NOT NULL,
    Quantity_Per_Unit INT NOT NULL,
    Revision_Number VARCHAR(5) NOT NULL,
    Effective_Date DATE NOT NULL,
    Status VARCHAR(20) NOT NULL,
    Engineering_Approval VARCHAR(10),
    Quality_Approval VARCHAR(10),
    Manufacturing_Approval VARCHAR(10),
    Notes TEXT,
    FOREIGN KEY (Batch_ID) REFERENCES ProductionBatch(Batch_ID),
    FOREIGN KEY (Product_ID) REFERENCES Product(Product_ID),
    FOREIGN KEY (Part_ID) REFERENCES Part(Part_ID)
);

-- Create BatchSupplier table
CREATE TABLE BatchSupplier (
    BatchSupplier_ID VARCHAR(10) PRIMARY KEY,
    Batch_ID VARCHAR(10) NOT NULL,
    Supplier_ID VARCHAR(10) NOT NULL,
    Material_Lot_Number VARCHAR(20) NOT NULL,
    Delivery_Date DATE NOT NULL,
    Quality_Check_Status VARCHAR(20),
    On_Time_Delivery VARCHAR(3),
    Quantity_Received INT,
    Quantity_Accepted INT,
    Rejection_Rate DECIMAL(5,2),
    Payment_Terms VARCHAR(20),
    Invoice_Number VARCHAR(30),
    Payment_Status VARCHAR(20),
    Notes TEXT,
    FOREIGN KEY (Batch_ID) REFERENCES ProductionBatch(Batch_ID),
    FOREIGN KEY (Supplier_ID) REFERENCES Supplier(Supplier_ID)
);

-- Create WarrantyClaims table
CREATE TABLE WarrantyClaim (
    Claim_ID VARCHAR(10) PRIMARY KEY,
    Product_ID VARCHAR(10) NOT NULL,
    Batch_ID VARCHAR(10) NOT NULL,
    Customer_ID VARCHAR(10),
    Dealer_ID VARCHAR(10),
    Claim_Date DATE NOT NULL,
    Installation_Date DATE,
    Failure_Date DATE NOT NULL,
    Claim_Status VARCHAR(20) NOT NULL,
    Failure_Mode VARCHAR(50),
    Failure_Cause VARCHAR(50),
    Failure_Resolution VARCHAR(50),
    Part_Condition VARCHAR(20),
    Mileage_At_Failure INT,
    Vehicle_Make VARCHAR(50),
    Vehicle_Model VARCHAR(50),
    Vehicle_Year INT,
    VIN VARCHAR(17),
    Labor_Hours DECIMAL(5,2),
    Labor_Cost DECIMAL(10,2),
    Parts_Cost DECIMAL(10,2),
    Total_Claim_Amount DECIMAL(10,2),
    Technician_Notes TEXT,
    Quality_Review_Status VARCHAR(20),
    Claim_Approval_Date DATE,
    Reimbursement_Date DATE,
    Claim_Processing_Time_Days INT,
    Warranty_Coverage_Percentage INT,
    Return_Material_Authorization VARCHAR(10),
    Root_Cause_Analysis_Completed VARCHAR(3),
    Corrective_Action_Required VARCHAR(3),
    Customer_Satisfaction_Score INT,
    FOREIGN KEY (Product_ID) REFERENCES Product(Product_ID),
    FOREIGN KEY (Batch_ID) REFERENCES ProductionBatch(Batch_ID)
);
