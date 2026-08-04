# Specifications

Every fix in this package has a testable spec. A spec is only satisfied
when its verification step passes on a clean checkout of main.

#### CQ-S1

- **Requirement**: No .slim file under app/views/ MAY be 0 bytes.
- **Verification**: find app/views -name '*.slim' -empty | wc -l outputs 0.

#### CQ-S2

- **Requirement**: No file under public/images/ MAY contain a space in its name.
- **Verification**: find public/images -name '* *' | wc -l outputs 0.

#### CQ-S3

- **Requirement**: No .slim file MAY use tab characters for indentation.
- **Verification**: grep -rPn '^\t' app/views/ exits 1.

#### CQ-S4

- **Requirement**: Test coverage on app/ MUST be >= 80%.
- **Verification**: bundle exec rspec; SimpleCov prints 80%+ and exits 0.

#### CQ-S5

- **Requirement**: README.md MUST be >= 500 bytes and contain setup, test, and deploy instructions.
- **Verification**: wc -c README.md outputs >= 500; grep -c 'Setup\|Tests\|Deploy' README.md outputs >= 3.

#### CQ-S6

- **Requirement**: config/unicorn/ MUST NOT exist; config/puma.rb MUST exist.
- **Verification**: test -d config/unicorn exits 1; test -f config/puma.rb exits 0.
