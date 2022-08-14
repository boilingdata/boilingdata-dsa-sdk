FROM public.ecr.aws/lambda/nodejs:16

RUN yum update -y && yum install -y curl wget bash libcurl-devel openssl11-devel openssl11 zlib-devel openssl11-static

RUN curl -sL https://rpm.nodesource.com/setup_16.x | bash - 
RUN yum install -y nodejs

RUN curl -sL https://dl.yarnpkg.com/rpm/yarn.repo -o /etc/yum.repos.d/yarn.repo
RUN yum install -y yarn && yarn --version
